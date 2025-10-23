const axios = require('axios')
const claudeConsoleAccountService = require('./claudeConsoleAccountService')
const logger = require('../utils/logger')
const config = require('../../config/config')
const {
  sanitizeUpstreamError,
  sanitizeErrorMessage,
  isAccountDisabledError
} = require('../utils/errorSanitizer')

class ClaudeConsoleRelayService {
  constructor() {
    this.defaultUserAgent = 'claude-cli/1.0.69 (external, cli)'
  }

  // 🚀 转发请求到Claude Console API
  async relayRequest(
    requestBody,
    apiKeyData,
    clientRequest,
    clientResponse,
    clientHeaders,
    accountId,
    options = {}
  ) {
    let abortController = null
    let account = null

    try {
      // 获取账户信息
      account = await claudeConsoleAccountService.getAccount(accountId)
      if (!account) {
        throw new Error('Claude Console Claude account not found')
      }

      logger.info(
        `📤 Processing Claude Console API request for key: ${apiKeyData.name || apiKeyData.id}, account: ${account.name} (${accountId})`
      )
      logger.debug(`🌐 Account API URL: ${account.apiUrl}`)
      logger.debug(`🔍 Account supportedModels: ${JSON.stringify(account.supportedModels)}`)
      logger.debug(`🔑 Account has apiKey: ${!!account.apiKey}`)
      logger.debug(`📝 Request model: ${requestBody.model}`)

      // 处理模型映射
      let mappedModel = requestBody.model
      if (
        account.supportedModels &&
        typeof account.supportedModels === 'object' &&
        !Array.isArray(account.supportedModels)
      ) {
        const newModel = claudeConsoleAccountService.getMappedModel(
          account.supportedModels,
          requestBody.model
        )
        if (newModel !== requestBody.model) {
          logger.info(`🔄 Mapping model from ${requestBody.model} to ${newModel}`)
          mappedModel = newModel
        }
      }

      // 创建修改后的请求体
      const modifiedRequestBody = {
        ...requestBody,
        model: mappedModel
      }

      // 模型兼容性检查已经在调度器中完成，这里不需要再检查

      // 创建代理agent
      const proxyAgent = claudeConsoleAccountService._createProxyAgent(account.proxy)

      // 创建AbortController用于取消请求
      abortController = new AbortController()

      // 设置客户端断开监听器
      const handleClientDisconnect = () => {
        logger.info('🔌 Client disconnected, aborting Claude Console Claude request')
        if (abortController && !abortController.signal.aborted) {
          abortController.abort()
        }
      }

      // 监听客户端断开事件
      if (clientRequest) {
        clientRequest.once('close', handleClientDisconnect)
      }
      if (clientResponse) {
        clientResponse.once('close', handleClientDisconnect)
      }

      // 构建完整的API URL
      const cleanUrl = account.apiUrl.replace(/\/$/, '') // 移除末尾斜杠
      let apiEndpoint

      if (options.customPath) {
        // 如果指定了自定义路径（如 count_tokens），使用它
        const baseUrl = cleanUrl.replace(/\/v1\/messages$/, '') // 移除已有的 /v1/messages
        apiEndpoint = `${baseUrl}${options.customPath}`
      } else {
        // 默认使用 messages 端点
        apiEndpoint = cleanUrl.endsWith('/v1/messages') ? cleanUrl : `${cleanUrl}/v1/messages`
      }

      // 过滤客户端请求头
      const filteredHeaders = this._filterClientHeaders(clientHeaders)
      // 决定使用的 User-Agent：优先使用账户自定义的，否则透传客户端的，最后才使用默认值
      const userAgent =
        account.userAgent ||
        clientHeaders?.['user-agent'] ||
        clientHeaders?.['User-Agent'] ||
        this.defaultUserAgent

      // 准备请求配置
      const requestConfig = {
        method: 'POST',
        url: apiEndpoint,
        data: modifiedRequestBody,
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'User-Agent': userAgent,
          ...filteredHeaders
        },
        timeout: config.requestTimeout || 120000,
        signal: abortController.signal,
        validateStatus: () => true // 接受所有状态码
      }

      if (proxyAgent) {
        requestConfig.httpAgent = proxyAgent
        requestConfig.httpsAgent = proxyAgent
        requestConfig.proxy = false
      }

      // 根据 API Key 格式选择认证方式
      if (account.apiKey && account.apiKey.startsWith('sk-ant-')) {
        // Anthropic 官方 API Key 使用 x-api-key
        requestConfig.headers['x-api-key'] = account.apiKey
      } else {
        // 其他 API Key 使用 Authorization Bearer
        requestConfig.headers['Authorization'] = `Bearer ${account.apiKey}`
      }

      logger.debug(
        `[DEBUG] Initial headers before beta: ${JSON.stringify(requestConfig.headers, null, 2)}`
      )

      // 添加beta header如果需要
      if (options.betaHeader) {
        requestConfig.headers['anthropic-beta'] = options.betaHeader
      }

      // 发送请求
      logger.debug(
        '📤 Sending request to Claude Console API with headers:',
        JSON.stringify(requestConfig.headers, null, 2)
      )
      const response = await axios(requestConfig)

      // 移除监听器（请求成功完成）
      if (clientRequest) {
        clientRequest.removeListener('close', handleClientDisconnect)
      }
      if (clientResponse) {
        clientResponse.removeListener('close', handleClientDisconnect)
      }

      logger.debug(`🔗 Claude Console API response: ${response.status}`)
      logger.debug(
        `[DEBUG] Response data length: ${response.data ? (typeof response.data === 'string' ? response.data.length : JSON.stringify(response.data).length) : 0}`
      )

      // 对于错误响应，记录原始错误和清理后的预览
      if (response.status < 200 || response.status >= 300) {
        // 记录原始错误响应（包含供应商信息，用于调试）
        const rawData =
          typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
        logger.error(
          `📝 Upstream error response from ${account?.name || accountId}: ${rawData.substring(0, 500)}`
        )

        // 记录清理后的数据到error
        try {
          const responseData =
            typeof response.data === 'string' ? JSON.parse(response.data) : response.data
          const sanitizedData = sanitizeUpstreamError(responseData)
          logger.error(`🧹 [SANITIZED] Error response to client: ${JSON.stringify(sanitizedData)}`)
        } catch (e) {
          const rawText =
            typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
          const sanitizedText = sanitizeErrorMessage(rawText)
          logger.error(`🧹 [SANITIZED] Error response to client: ${sanitizedText}`)
        }
      } else {
        logger.debug(
          `[DEBUG] Response data preview: ${typeof response.data === 'string' ? response.data.substring(0, 200) : JSON.stringify(response.data).substring(0, 200)}`
        )
      }

      // 检查是否为账户禁用/不可用的 400 错误
      const accountDisabledError = isAccountDisabledError(response.status, response.data)

      // 检查错误状态并相应处理
      if (response.status === 401) {
        logger.warn(`🚫 Unauthorized error detected for Claude Console account ${accountId}`)
        await claudeConsoleAccountService.markAccountUnauthorized(accountId)
      } else if (accountDisabledError) {
        logger.error(
          `🚫 Account disabled error (400) detected for Claude Console account ${accountId}, marking as blocked`
        )
        // 传入完整的错误详情到 webhook
        const errorDetails =
          typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
        await claudeConsoleAccountService.markConsoleAccountBlocked(accountId, errorDetails)
      } else if (response.status === 429) {
        logger.warn(`🚫 Rate limit detected for Claude Console account ${accountId}`)
        // 收到429先检查是否因为超过了手动配置的每日额度
        await claudeConsoleAccountService.checkQuotaUsage(accountId).catch((err) => {
          logger.error('❌ Failed to check quota after 429 error:', err)
        })

        await claudeConsoleAccountService.markAccountRateLimited(accountId)
      } else if (response.status === 529) {
        logger.warn(`🚫 Overload error detected for Claude Console account ${accountId}`)
        await claudeConsoleAccountService.markAccountOverloaded(accountId)
      } else if (response.status === 200 || response.status === 201) {
        // 如果请求成功，检查并移除错误状态
        const isRateLimited = await claudeConsoleAccountService.isAccountRateLimited(accountId)
        if (isRateLimited) {
          await claudeConsoleAccountService.removeAccountRateLimit(accountId)
        }
        const isOverloaded = await claudeConsoleAccountService.isAccountOverloaded(accountId)
        if (isOverloaded) {
          await claudeConsoleAccountService.removeAccountOverload(accountId)
        }
      }

      // 更新最后使用时间
      await this._updateLastUsedTime(accountId)

      // 准备响应体并清理错误信息（如果是错误响应）
      let responseBody
      if (response.status < 200 || response.status >= 300) {
        // 错误响应，清理供应商信息
        try {
          const responseData =
            typeof response.data === 'string' ? JSON.parse(response.data) : response.data
          const sanitizedData = sanitizeUpstreamError(responseData)
          responseBody = JSON.stringify(sanitizedData)
          logger.debug(`🧹 Sanitized error response`)
        } catch (parseError) {
          // 如果无法解析为JSON，尝试清理文本
          const rawText =
            typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
          responseBody = sanitizeErrorMessage(rawText)
          logger.debug(`🧹 Sanitized error text`)
        }
      } else {
        // 成功响应，不需要清理
        responseBody =
          typeof response.data === 'string' ? response.data : JSON.stringify(response.data)
      }

      return {
        statusCode: response.status,
        headers: response.headers,
        body: responseBody,
        accountId
      }
    } catch (error) {
      // 处理特定错误
      if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
        logger.info('Request aborted due to client disconnect')
        throw new Error('Client disconnected')
      }

      logger.error(
        `❌ Claude Console relay request failed (Account: ${account?.name || accountId}):`,
        error.message
      )

      // 不再因为模型不支持而block账号

      throw error
    }
  }

  // 🌊 处理流式响应
  async relayStreamRequestWithUsageCapture(
    requestBody,
    apiKeyData,
    responseStream,
    clientHeaders,
    usageCallback,
    accountId,
    streamTransformer = null,
    options = {}
  ) {
    let account = null
    try {
      // 获取账户信息
      account = await claudeConsoleAccountService.getAccount(accountId)
      if (!account) {
        throw new Error('Claude Console Claude account not found')
      }

      logger.info(
        `📡 Processing streaming Claude Console API request for key: ${apiKeyData.name || apiKeyData.id}, account: ${account.name} (${accountId})`
      )
      logger.debug(`🌐 Account API URL: ${account.apiUrl}`)

      // 处理模型映射
      let mappedModel = requestBody.model
      if (
        account.supportedModels &&
        typeof account.supportedModels === 'object' &&
        !Array.isArray(account.supportedModels)
      ) {
        const newModel = claudeConsoleAccountService.getMappedModel(
          account.supportedModels,
          requestBody.model
        )
        if (newModel !== requestBody.model) {
          logger.info(`🔄 [Stream] Mapping model from ${requestBody.model} to ${newModel}`)
          mappedModel = newModel
        }
      }

      // 创建修改后的请求体
      const modifiedRequestBody = {
        ...requestBody,
        model: mappedModel
      }

      // 模型兼容性检查已经在调度器中完成，这里不需要再检查

      // 创建代理agent
      const proxyAgent = claudeConsoleAccountService._createProxyAgent(account.proxy)

      // 发送流式请求
      await this._makeClaudeConsoleStreamRequest(
        modifiedRequestBody,
        account,
        proxyAgent,
        clientHeaders,
        responseStream,
        accountId,
        usageCallback,
        streamTransformer,
        options
      )

      // 更新最后使用时间
      await this._updateLastUsedTime(accountId)
    } catch (error) {
      logger.error(
        `❌ Claude Console stream relay failed (Account: ${account?.name || accountId}):`,
        error
      )
      throw error
    }
  }

  // 🌊 发送流式请求到Claude Console API
  async _makeClaudeConsoleStreamRequest(
    body,
    account,
    proxyAgent,
    clientHeaders,
    responseStream,
    accountId,
    usageCallback,
    streamTransformer = null,
    requestOptions = {}
  ) {
    return new Promise((resolve, reject) => {
      let aborted = false

      // 构建完整的API URL
      const cleanUrl = account.apiUrl.replace(/\/$/, '') // 移除末尾斜杠
      const apiEndpoint = cleanUrl.endsWith('/v1/messages') ? cleanUrl : `${cleanUrl}/v1/messages`

      // 过滤客户端请求头
      const filteredHeaders = this._filterClientHeaders(clientHeaders)
      // 决定使用的 User-Agent：优先使用账户自定义的，否则透传客户端的，最后才使用默认值
      const userAgent =
        account.userAgent ||
        clientHeaders?.['user-agent'] ||
        clientHeaders?.['User-Agent'] ||
        this.defaultUserAgent

      // 准备请求配置
      const requestConfig = {
        method: 'POST',
        url: apiEndpoint,
        data: body,
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'User-Agent': userAgent,
          ...filteredHeaders
        },
        timeout: config.requestTimeout || 120000,
        responseType: 'stream',
        validateStatus: () => true // 接受所有状态码
      }

      if (proxyAgent) {
        requestConfig.httpAgent = proxyAgent
        requestConfig.httpsAgent = proxyAgent
        requestConfig.proxy = false
      }

      // 根据 API Key 格式选择认证方式
      if (account.apiKey && account.apiKey.startsWith('sk-ant-')) {
        // Anthropic 官方 API Key 使用 x-api-key
        requestConfig.headers['x-api-key'] = account.apiKey
      } else {
        // 其他 API Key 使用 Authorization Bearer
        requestConfig.headers['Authorization'] = `Bearer ${account.apiKey}`
      }

      // 添加beta header如果需要
      if (requestOptions.betaHeader) {
        requestConfig.headers['anthropic-beta'] = requestOptions.betaHeader
      }

      // 发送请求
      const request = axios(requestConfig)

      request
        .then((response) => {
          logger.debug(`🌊 Claude Console Claude stream response status: ${response.status}`)

          // 错误响应处理
          if (response.status !== 200) {
            logger.error(
              `❌ Claude Console API returned error status: ${response.status} | Account: ${account?.name || accountId}`
            )

            // 收集错误数据用于检测
            let errorDataForCheck = ''
            const errorChunks = []

            response.data.on('data', (chunk) => {
              errorChunks.push(chunk)
              errorDataForCheck += chunk.toString()
            })

            response.data.on('end', async () => {
              // 记录原始错误消息到日志（方便调试，包含供应商信息）
              logger.error(
                `📝 [Stream] Upstream error response from ${account?.name || accountId}: ${errorDataForCheck.substring(0, 500)}`
              )

              // 检查是否为账户禁用错误
              const accountDisabledError = isAccountDisabledError(
                response.status,
                errorDataForCheck
              )

              if (response.status === 401) {
                await claudeConsoleAccountService.markAccountUnauthorized(accountId)
              } else if (accountDisabledError) {
                logger.error(
                  `🚫 [Stream] Account disabled error (400) detected for Claude Console account ${accountId}, marking as blocked`
                )
                // 传入完整的错误详情到 webhook
                await claudeConsoleAccountService.markConsoleAccountBlocked(
                  accountId,
                  errorDataForCheck
                )
              } else if (response.status === 429) {
                await claudeConsoleAccountService.markAccountRateLimited(accountId)
                // 检查是否因为超过每日额度
                claudeConsoleAccountService.checkQuotaUsage(accountId).catch((err) => {
                  logger.error('❌ Failed to check quota after 429 error:', err)
                })
              } else if (response.status === 529) {
                await claudeConsoleAccountService.markAccountOverloaded(accountId)
              }

              // 设置响应头
              if (!responseStream.headersSent) {
                responseStream.writeHead(response.status, {
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-cache'
                })
              }

              // 清理并发送错误响应
              try {
                const fullErrorData = Buffer.concat(errorChunks).toString()
                const errorJson = JSON.parse(fullErrorData)
                const sanitizedError = sanitizeUpstreamError(errorJson)

                // 记录清理后的错误消息（发送给客户端的，完整记录）
                logger.error(
                  `🧹 [Stream] [SANITIZED] Error response to client: ${JSON.stringify(sanitizedError)}`
                )

                if (!responseStream.destroyed) {
                  responseStream.write(JSON.stringify(sanitizedError))
                  responseStream.end()
                }
              } catch (parseError) {
                const sanitizedText = sanitizeErrorMessage(errorDataForCheck)
                logger.error(`🧹 [Stream] [SANITIZED] Error response to client: ${sanitizedText}`)

                if (!responseStream.destroyed) {
                  responseStream.write(sanitizedText)
                  responseStream.end()
                }
              }
              resolve() // 不抛出异常，正常完成流处理
            })

            return
          }

          // 成功响应，检查并移除错误状态
          claudeConsoleAccountService.isAccountRateLimited(accountId).then((isRateLimited) => {
            if (isRateLimited) {
              claudeConsoleAccountService.removeAccountRateLimit(accountId)
            }
          })
          claudeConsoleAccountService.isAccountOverloaded(accountId).then((isOverloaded) => {
            if (isOverloaded) {
              claudeConsoleAccountService.removeAccountOverload(accountId)
            }
          })

          // 设置响应头
          if (!responseStream.headersSent) {
            responseStream.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
              'X-Accel-Buffering': 'no'
            })
          }

          let buffer = ''
          let finalUsageReported = false
          const collectedUsageData = {
            model: body.model || account?.defaultModel || null
          }

          // 处理流数据
          response.data.on('data', (chunk) => {
            try {
              if (aborted) {
                return
              }

              const chunkStr = chunk.toString()
              buffer += chunkStr

              // 处理完整的SSE行
              const lines = buffer.split('\n')
              buffer = lines.pop() || ''

              // 转发数据并解析usage
              if (lines.length > 0 && !responseStream.destroyed) {
                const linesToForward = lines.join('\n') + (lines.length > 0 ? '\n' : '')

                // 应用流转换器如果有
                if (streamTransformer) {
                  const transformed = streamTransformer(linesToForward)
                  if (transformed) {
                    responseStream.write(transformed)
                  }
                } else {
                  responseStream.write(linesToForward)
                }

                // 解析SSE数据寻找usage信息
                for (const line of lines) {
                  if (line.startsWith('data:')) {
                    const jsonStr = line.slice(5).trimStart()
                    if (!jsonStr || jsonStr === '[DONE]') {
                      continue
                    }
                    try {
                      const data = JSON.parse(jsonStr)

                      // 收集usage数据
                      if (data.type === 'message_start' && data.message && data.message.usage) {
                        collectedUsageData.input_tokens = data.message.usage.input_tokens || 0
                        collectedUsageData.cache_creation_input_tokens =
                          data.message.usage.cache_creation_input_tokens || 0
                        collectedUsageData.cache_read_input_tokens =
                          data.message.usage.cache_read_input_tokens || 0
                        collectedUsageData.model = data.message.model

                        // 检查是否有详细的 cache_creation 对象
                        if (
                          data.message.usage.cache_creation &&
                          typeof data.message.usage.cache_creation === 'object'
                        ) {
                          collectedUsageData.cache_creation = {
                            ephemeral_5m_input_tokens:
                              data.message.usage.cache_creation.ephemeral_5m_input_tokens || 0,
                            ephemeral_1h_input_tokens:
                              data.message.usage.cache_creation.ephemeral_1h_input_tokens || 0
                          }
                          logger.info(
                            '📊 Collected detailed cache creation data:',
                            JSON.stringify(collectedUsageData.cache_creation)
                          )
                        }
                      }

                      if (data.type === 'message_delta' && data.usage) {
                        // 提取所有usage字段，message_delta可能包含完整的usage信息
                        if (data.usage.output_tokens !== undefined) {
                          collectedUsageData.output_tokens = data.usage.output_tokens || 0
                        }

                        // 提取input_tokens（如果存在）
                        if (data.usage.input_tokens !== undefined) {
                          collectedUsageData.input_tokens = data.usage.input_tokens || 0
                        }

                        // 提取cache相关的tokens
                        if (data.usage.cache_creation_input_tokens !== undefined) {
                          collectedUsageData.cache_creation_input_tokens =
                            data.usage.cache_creation_input_tokens || 0
                        }
                        if (data.usage.cache_read_input_tokens !== undefined) {
                          collectedUsageData.cache_read_input_tokens =
                            data.usage.cache_read_input_tokens || 0
                        }

                        // 检查是否有详细的 cache_creation 对象
                        if (
                          data.usage.cache_creation &&
                          typeof data.usage.cache_creation === 'object'
                        ) {
                          collectedUsageData.cache_creation = {
                            ephemeral_5m_input_tokens:
                              data.usage.cache_creation.ephemeral_5m_input_tokens || 0,
                            ephemeral_1h_input_tokens:
                              data.usage.cache_creation.ephemeral_1h_input_tokens || 0
                          }
                        }

                        logger.info(
                          '📊 [Console] Collected usage data from message_delta:',
                          JSON.stringify(collectedUsageData)
                        )

                        // 如果已经收集到了完整数据，触发回调
                        if (
                          collectedUsageData.input_tokens !== undefined &&
                          collectedUsageData.output_tokens !== undefined &&
                          !finalUsageReported
                        ) {
                          if (!collectedUsageData.model) {
                            collectedUsageData.model = body.model || account?.defaultModel || null
                          }
                          logger.info(
                            '🎯 [Console] Complete usage data collected:',
                            JSON.stringify(collectedUsageData)
                          )
                          usageCallback({ ...collectedUsageData, accountId })
                          finalUsageReported = true
                        }
                      }

                      // 不再因为模型不支持而block账号
                    } catch (e) {
                      // 忽略解析错误
                    }
                  }
                }
              }
            } catch (error) {
              logger.error(
                `❌ Error processing Claude Console stream data (Account: ${account?.name || accountId}):`,
                error
              )
              if (!responseStream.destroyed) {
                responseStream.write('event: error\n')
                responseStream.write(
                  `data: ${JSON.stringify({
                    error: 'Stream processing error',
                    message: error.message,
                    timestamp: new Date().toISOString()
                  })}\n\n`
                )
              }
            }
          })

          response.data.on('end', () => {
            try {
              // 处理缓冲区中剩余的数据
              if (buffer.trim() && !responseStream.destroyed) {
                if (streamTransformer) {
                  const transformed = streamTransformer(buffer)
                  if (transformed) {
                    responseStream.write(transformed)
                  }
                } else {
                  responseStream.write(buffer)
                }
              }

              // 🔧 兜底逻辑：确保所有未保存的usage数据都不会丢失
              if (!finalUsageReported) {
                if (
                  collectedUsageData.input_tokens !== undefined ||
                  collectedUsageData.output_tokens !== undefined
                ) {
                  // 补全缺失的字段
                  if (collectedUsageData.input_tokens === undefined) {
                    collectedUsageData.input_tokens = 0
                    logger.warn(
                      '⚠️ [Console] message_delta missing input_tokens, setting to 0. This may indicate incomplete usage data.'
                    )
                  }
                  if (collectedUsageData.output_tokens === undefined) {
                    collectedUsageData.output_tokens = 0
                    logger.warn(
                      '⚠️ [Console] message_delta missing output_tokens, setting to 0. This may indicate incomplete usage data.'
                    )
                  }
                  // 确保有 model 字段
                  if (!collectedUsageData.model) {
                    collectedUsageData.model = body.model || account?.defaultModel || null
                  }
                  logger.info(
                    `📊 [Console] Saving incomplete usage data via fallback: ${JSON.stringify(collectedUsageData)}`
                  )
                  usageCallback({ ...collectedUsageData, accountId })
                  finalUsageReported = true
                } else {
                  logger.warn(
                    '⚠️ [Console] Stream completed but no usage data was captured! This indicates a problem with SSE parsing or API response format.'
                  )
                }
              }

              // 确保流正确结束
              if (!responseStream.destroyed) {
                responseStream.end()
              }

              logger.debug('🌊 Claude Console Claude stream response completed')
              resolve()
            } catch (error) {
              logger.error('❌ Error processing stream end:', error)
              reject(error)
            }
          })

          response.data.on('error', (error) => {
            logger.error(
              `❌ Claude Console stream error (Account: ${account?.name || accountId}):`,
              error
            )
            if (!responseStream.destroyed) {
              responseStream.write('event: error\n')
              responseStream.write(
                `data: ${JSON.stringify({
                  error: 'Stream error',
                  message: error.message,
                  timestamp: new Date().toISOString()
                })}\n\n`
              )
              responseStream.end()
            }
            reject(error)
          })
        })
        .catch((error) => {
          if (aborted) {
            return
          }

          logger.error(
            `❌ Claude Console stream request error (Account: ${account?.name || accountId}):`,
            error.message
          )

          // 检查错误状态
          if (error.response) {
            if (error.response.status === 401) {
              claudeConsoleAccountService.markAccountUnauthorized(accountId)
            } else if (error.response.status === 429) {
              claudeConsoleAccountService.markAccountRateLimited(accountId)
              // 检查是否因为超过每日额度
              claudeConsoleAccountService.checkQuotaUsage(accountId).catch((err) => {
                logger.error('❌ Failed to check quota after 429 error:', err)
              })
            } else if (error.response.status === 529) {
              claudeConsoleAccountService.markAccountOverloaded(accountId)
            }
          }

          // 发送错误响应
          if (!responseStream.headersSent) {
            responseStream.writeHead(error.response?.status || 500, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive'
            })
          }

          if (!responseStream.destroyed) {
            responseStream.write('event: error\n')
            responseStream.write(
              `data: ${JSON.stringify({
                error: error.message,
                code: error.code,
                timestamp: new Date().toISOString()
              })}\n\n`
            )
            responseStream.end()
          }

          reject(error)
        })

      // 处理客户端断开连接
      responseStream.on('close', () => {
        logger.debug('🔌 Client disconnected, cleaning up Claude Console stream')
        aborted = true
      })
    })
  }

  // 🔧 过滤客户端请求头
  _filterClientHeaders(clientHeaders) {
    const sensitiveHeaders = [
      'content-type',
      'user-agent',
      'authorization',
      'x-api-key',
      'host',
      'content-length',
      'connection',
      'proxy-authorization',
      'content-encoding',
      'transfer-encoding',
      'anthropic-version'
    ]

    const filteredHeaders = {}

    Object.keys(clientHeaders || {}).forEach((key) => {
      const lowerKey = key.toLowerCase()
      if (!sensitiveHeaders.includes(lowerKey)) {
        filteredHeaders[key] = clientHeaders[key]
      }
    })

    return filteredHeaders
  }

  // 🕐 更新最后使用时间
  async _updateLastUsedTime(accountId) {
    try {
      const client = require('../models/redis').getClientSafe()
      const accountKey = `claude_console_account:${accountId}`
      const exists = await client.exists(accountKey)

      if (!exists) {
        logger.debug(`🔎 跳过更新已删除的Claude Console账号最近使用时间: ${accountId}`)
        return
      }

      await client.hset(accountKey, 'lastUsedAt', new Date().toISOString())
    } catch (error) {
      logger.warn(
        `⚠️ Failed to update last used time for Claude Console account ${accountId}:`,
        error.message
      )
    }
  }

  // 🎯 健康检查
  async healthCheck() {
    try {
      const accounts = await claudeConsoleAccountService.getAllAccounts()
      const activeAccounts = accounts.filter((acc) => acc.isActive && acc.status === 'active')

      return {
        healthy: activeAccounts.length > 0,
        activeAccounts: activeAccounts.length,
        totalAccounts: accounts.length,
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      logger.error('❌ Claude Console Claude health check failed:', error)
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date().toISOString()
      }
    }
  }
}

module.exports = new ClaudeConsoleRelayService()
