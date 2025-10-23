/**
 * 请求限制中间件
 * 防止过大的请求导致DoS攻击
 */

const config = require('../../config/config')
const logger = require('../utils/logger')

// 默认限制配置
const DEFAULT_LIMITS = {
  // JSON请求体大小限制
  jsonLimit: '10mb',
  // URL编码请求体大小限制
  urlencodedLimit: '10mb',
  // 文本请求体大小限制
  textLimit: '10mb',
  // 原始请求体大小限制
  rawLimit: '50mb',
  // 请求参数数量限制
  parameterLimit: 1000,
  // 请求头大小限制（字节）
  headerLimit: 16384, // 16KB
  // 特定路由的自定义限制
  routeLimits: {
    '/api/v1/messages': '25mb', // Claude API可能需要更大的限制
    '/claude/v1/messages': '25mb',
    '/gemini/v1/models': '25mb',
    '/openai/v1/chat/completions': '25mb',
    '/droid/claude/v1/messages': '25mb',
    '/admin/import': '100mb', // 数据导入可能需要更大限制
    '/admin/export': '10mb',
    '/admin/webhook': '1mb', // Webhook配置不需要大请求
    '/users/register': '1mb',
    '/users/login': '1mb'
  }
}

/**
 * 解析大小字符串为字节数
 * @param {string} size - 大小字符串（如 '10mb', '1kb'）
 * @returns {number} 字节数
 */
function parseSize(size) {
  if (typeof size === 'number') {
    return size
  }

  const units = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  }

  const match = /^(\d+(?:\.\d+)?)\s*([a-z]+)$/i.exec(size)
  if (!match) {
    throw new Error(`Invalid size format: ${size}`)
  }

  const [, value, unit] = match
  const unitLower = unit.toLowerCase()

  if (!units[unitLower]) {
    throw new Error(`Unknown size unit: ${unit}`)
  }

  return Math.floor(parseFloat(value) * units[unitLower])
}

/**
 * 获取路由的请求大小限制
 * @param {string} path - 请求路径
 * @returns {string} 大小限制
 */
function getRouteLimit(path) {
  // 检查精确匹配
  if (DEFAULT_LIMITS.routeLimits[path]) {
    return DEFAULT_LIMITS.routeLimits[path]
  }

  // 检查前缀匹配
  for (const [route, limit] of Object.entries(DEFAULT_LIMITS.routeLimits)) {
    if (path.startsWith(route.replace(/:\w+/g, ''))) {
      return limit
    }
  }

  // 返回默认限制
  return DEFAULT_LIMITS.jsonLimit
}

/**
 * 请求头大小检查中间件
 */
const checkHeaderSize = (req, res, next) => {
  try {
    // 计算请求头总大小
    let headerSize = 0

    // 计算请求行大小（方法 + URL + 协议）
    const requestLine = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`
    headerSize += Buffer.byteLength(requestLine)

    // 计算所有请求头的大小
    for (const [key, value] of Object.entries(req.headers)) {
      const headerLine = `${key}: ${Array.isArray(value) ? value.join(', ') : value}\r\n`
      headerSize += Buffer.byteLength(headerLine)
    }

    // 检查是否超过限制
    const limit = config.requestLimits?.headerLimit || DEFAULT_LIMITS.headerLimit
    if (headerSize > limit) {
      logger.security(
        `🚫 Request header too large: ${headerSize} bytes (limit: ${limit} bytes) from ${req.ip}`
      )
      return res.status(431).json({
        error: 'Request Header Fields Too Large',
        message: `Request headers exceed the maximum allowed size of ${limit} bytes`,
        currentSize: headerSize,
        limit
      })
    }

    next()
  } catch (error) {
    logger.error('Error checking header size:', error)
    next()
  }
}

/**
 * 请求体大小限制中间件
 */
const checkBodySize = (req, res, next) => {
  // 获取当前路由的限制
  const limitStr = getRouteLimit(req.path)
  const limit = parseSize(limitStr)

  // 如果有 Content-Length 头，先检查
  const contentLength = parseInt(req.headers['content-length'] || '0', 10)
  if (contentLength > limit) {
    logger.security(
      `🚫 Request body too large: ${contentLength} bytes (limit: ${limit} bytes) from ${req.ip} for ${req.path}`
    )
    return res.status(413).json({
      error: 'Payload Too Large',
      message: `Request body exceeds the maximum allowed size of ${limitStr}`,
      currentSize: contentLength,
      limit: limitStr
    })
  }

  // 监控实际接收的数据大小
  let receivedSize = 0
  const originalWrite = req.write
  const originalEnd = req.end

  // 重写 write 方法
  req.write = function (chunk, encoding, callback) {
    receivedSize += chunk ? chunk.length : 0

    if (receivedSize > limit) {
      logger.security(
        `🚫 Request body exceeded limit during transmission: ${receivedSize} bytes (limit: ${limit} bytes) from ${req.ip}`
      )
      req.destroy()
      return false
    }

    return originalWrite.call(this, chunk, encoding, callback)
  }

  // 重写 end 方法
  req.end = function (chunk, encoding, callback) {
    if (chunk) {
      receivedSize += chunk.length
    }

    if (receivedSize > limit) {
      logger.security(
        `🚫 Request body exceeded limit at end: ${receivedSize} bytes (limit: ${limit} bytes) from ${req.ip}`
      )
      req.destroy()
      return false
    }

    return originalEnd.call(this, chunk, encoding, callback)
  }

  // 监控数据事件
  req.on('data', (chunk) => {
    receivedSize += chunk.length

    if (receivedSize > limit) {
      logger.security(
        `🚫 Request body exceeded limit: ${receivedSize} bytes (limit: ${limit} bytes) from ${req.ip}`
      )
      req.pause()
      req.destroy()

      if (!res.headersSent) {
        res.status(413).json({
          error: 'Payload Too Large',
          message: `Request body exceeds the maximum allowed size of ${limitStr}`,
          currentSize: receivedSize,
          limit: limitStr
        })
      }
    }
  })

  next()
}

/**
 * URL参数数量限制中间件
 */
const checkParameterCount = (req, res, next) => {
  try {
    const limit = config.requestLimits?.parameterLimit || DEFAULT_LIMITS.parameterLimit

    // 检查查询参数数量
    const queryParams = Object.keys(req.query || {}).length
    const bodyParams = req.body ? Object.keys(req.body).length : 0
    const totalParams = queryParams + bodyParams

    if (totalParams > limit) {
      logger.security(`🚫 Too many parameters: ${totalParams} (limit: ${limit}) from ${req.ip}`)
      return res.status(413).json({
        error: 'Too Many Parameters',
        message: `Request contains too many parameters (${totalParams}). Maximum allowed: ${limit}`,
        queryParams,
        bodyParams,
        totalParams,
        limit
      })
    }

    next()
  } catch (error) {
    logger.error('Error checking parameter count:', error)
    next()
  }
}

/**
 * 防止请求走私攻击
 */
const preventRequestSmuggling = (req, res, next) => {
  // 检查冲突的Content-Length和Transfer-Encoding头
  if (req.headers['content-length'] && req.headers['transfer-encoding']) {
    logger.security(
      `🚫 Request smuggling attempt detected: both Content-Length and Transfer-Encoding present from ${req.ip}`
    )
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid request headers'
    })
  }

  // 检查多个Content-Length头
  const contentLengthHeader = req.headers['content-length']
  if (Array.isArray(contentLengthHeader)) {
    logger.security(`🚫 Multiple Content-Length headers detected from ${req.ip}`)
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Multiple Content-Length headers are not allowed'
    })
  }

  // 检查Transfer-Encoding的有效值
  const transferEncoding = req.headers['transfer-encoding']
  if (transferEncoding && !['chunked', 'compress', 'deflate', 'gzip'].includes(transferEncoding)) {
    logger.security(`🚫 Invalid Transfer-Encoding value: ${transferEncoding} from ${req.ip}`)
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid Transfer-Encoding header'
    })
  }

  next()
}

/**
 * 组合所有请求限制中间件
 */
const requestLimiter = [
  checkHeaderSize,
  preventRequestSmuggling,
  checkBodySize,
  checkParameterCount
]

module.exports = {
  requestLimiter,
  checkHeaderSize,
  checkBodySize,
  checkParameterCount,
  preventRequestSmuggling,
  DEFAULT_LIMITS,
  parseSize,
  getRouteLimit
}
