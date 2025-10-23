const geminiAccountService = require('./geminiAccountService')
const accountGroupService = require('./accountGroupService')
const redis = require('../models/redis')
const logger = require('../utils/logger')
const intelligentAccountSelector = require('./intelligentAccountSelector')

class UnifiedGeminiScheduler {
  constructor() {
    this.SESSION_MAPPING_PREFIX = 'unified_gemini_session_mapping:'
  }

  // 🔧 辅助方法：检查账户是否可调度（兼容字符串和布尔值）
  _isSchedulable(schedulable) {
    // 如果是 undefined 或 null，默认为可调度
    if (schedulable === undefined || schedulable === null) {
      return true
    }
    // 明确设置为 false（布尔值）或 'false'（字符串）时不可调度
    return schedulable !== false && schedulable !== 'false'
  }

  // 🎯 统一调度Gemini账号
  async selectAccountForApiKey(apiKeyData, sessionHash = null, requestedModel = null) {
    try {
      // 如果API Key绑定了专属账户或分组，优先使用
      if (apiKeyData.geminiAccountId) {
        // 检查是否是分组
        if (apiKeyData.geminiAccountId.startsWith('group:')) {
          const groupId = apiKeyData.geminiAccountId.replace('group:', '')
          logger.info(
            `🎯 API key ${apiKeyData.name} is bound to group ${groupId}, selecting from group`
          )
          return await this.selectAccountFromGroup(groupId, sessionHash, requestedModel, apiKeyData)
        }

        // 普通专属账户
        const boundAccount = await geminiAccountService.getAccount(apiKeyData.geminiAccountId)
        if (boundAccount && boundAccount.isActive === 'true' && boundAccount.status !== 'error') {
          logger.info(
            `🎯 Using bound dedicated Gemini account: ${boundAccount.name} (${apiKeyData.geminiAccountId}) for API key ${apiKeyData.name}`
          )
          // 更新账户的最后使用时间
          await geminiAccountService.markAccountUsed(apiKeyData.geminiAccountId)
          return {
            accountId: apiKeyData.geminiAccountId,
            accountType: 'gemini'
          }
        } else {
          logger.warn(
            `⚠️ Bound Gemini account ${apiKeyData.geminiAccountId} is not available, falling back to pool`
          )
        }
      }

      // 如果有会话哈希，检查是否有已映射的账户
      if (sessionHash) {
        const mappedAccount = await this._getSessionMapping(sessionHash)
        if (mappedAccount) {
          // 验证映射的账户是否仍然可用
          const isAvailable = await this._isAccountAvailable(
            mappedAccount.accountId,
            mappedAccount.accountType
          )
          if (isAvailable) {
            // 🚀 智能会话续期（续期 unified 映射键，按配置）
            await this._extendSessionMappingTTL(sessionHash)
            logger.info(
              `🎯 Using sticky session account: ${mappedAccount.accountId} (${mappedAccount.accountType}) for session ${sessionHash}`
            )
            // 更新账户的最后使用时间
            await geminiAccountService.markAccountUsed(mappedAccount.accountId)
            return mappedAccount
          } else {
            logger.warn(
              `⚠️ Mapped account ${mappedAccount.accountId} is no longer available, selecting new account`
            )
            await this._deleteSessionMapping(sessionHash)
          }
        }
      }

      // 获取所有可用账户
      const availableAccounts = await this._getAllAvailableAccounts(apiKeyData, requestedModel)

      if (availableAccounts.length === 0) {
        // 提供更详细的错误信息
        if (requestedModel) {
          throw new Error(
            `No available Gemini accounts support the requested model: ${requestedModel}`
          )
        } else {
          throw new Error('No available Gemini accounts')
        }
      }

      // 🧠 使用智能账户选择器基于余额使用率选择最优账户
      const selectedAccount = await intelligentAccountSelector.selectOptimalAccount(
        apiKeyData,
        availableAccounts,
        'gemini',
        requestedModel
      )

      // 如果有会话哈希，建立新的映射
      if (sessionHash) {
        await this._setSessionMapping(
          sessionHash,
          selectedAccount.accountId,
          selectedAccount.accountType
        )
        logger.info(
          `🎯 Created new sticky session mapping: ${selectedAccount.name} (${selectedAccount.accountId}, ${selectedAccount.accountType}) for session ${sessionHash}`
        )
      }

      logger.info(
        `🎯 Selected account: ${selectedAccount.name} (${selectedAccount.accountId}, ${selectedAccount.accountType}) with priority ${selectedAccount.priority} for API key ${apiKeyData.name}`
      )

      // 更新账户的最后使用时间
      await geminiAccountService.markAccountUsed(selectedAccount.accountId)

      return {
        accountId: selectedAccount.accountId,
        accountType: selectedAccount.accountType
      }
    } catch (error) {
      logger.error('❌ Failed to select account for API key:', error)
      throw error
    }
  }

  // 📋 获取所有可用账户
  async _getAllAvailableAccounts(apiKeyData, requestedModel = null) {
    const availableAccounts = []

    // 如果API Key绑定了专属账户，优先返回
    if (apiKeyData.geminiAccountId) {
      const boundAccount = await geminiAccountService.getAccount(apiKeyData.geminiAccountId)
      if (boundAccount && boundAccount.isActive === 'true' && boundAccount.status !== 'error') {
        const isRateLimited = await this.isAccountRateLimited(boundAccount.id)
        if (!isRateLimited) {
          // 检查模型支持
          if (
            requestedModel &&
            boundAccount.supportedModels &&
            boundAccount.supportedModels.length > 0
          ) {
            // 处理可能带有 models/ 前缀的模型名
            const normalizedModel = requestedModel.replace('models/', '')
            const modelSupported = boundAccount.supportedModels.some(
              (model) => model.replace('models/', '') === normalizedModel
            )
            if (!modelSupported) {
              logger.warn(
                `⚠️ Bound Gemini account ${boundAccount.name} does not support model ${requestedModel}`
              )
              return availableAccounts
            }
          }

          logger.info(
            `🎯 Using bound dedicated Gemini account: ${boundAccount.name} (${apiKeyData.geminiAccountId})`
          )
          return [
            {
              ...boundAccount,
              accountId: boundAccount.id,
              accountType: 'gemini',
              priority: parseInt(boundAccount.priority) || 50,
              lastUsedAt: boundAccount.lastUsedAt || '0'
            }
          ]
        }
      } else {
        logger.warn(`⚠️ Bound Gemini account ${apiKeyData.geminiAccountId} is not available`)
      }
    }

    // 获取所有Gemini账户（共享池）
    const geminiAccounts = await geminiAccountService.getAllAccounts()
    for (const account of geminiAccounts) {
      if (
        account.isActive === 'true' &&
        account.status !== 'error' &&
        (account.accountType === 'shared' || !account.accountType) && // 兼容旧数据
        this._isSchedulable(account.schedulable)
      ) {
        // 检查是否可调度

        // 检查token是否过期
        const isExpired = geminiAccountService.isTokenExpired(account)
        if (isExpired && !account.refreshToken) {
          logger.warn(
            `⚠️ Gemini account ${account.name} token expired and no refresh token available`
          )
          continue
        }

        // 检查模型支持
        if (requestedModel && account.supportedModels && account.supportedModels.length > 0) {
          // 处理可能带有 models/ 前缀的模型名
          const normalizedModel = requestedModel.replace('models/', '')
          const modelSupported = account.supportedModels.some(
            (model) => model.replace('models/', '') === normalizedModel
          )
          if (!modelSupported) {
            logger.debug(
              `⏭️ Skipping Gemini account ${account.name} - doesn't support model ${requestedModel}`
            )
            continue
          }
        }

        // 检查是否被限流
        const isRateLimited = await this.isAccountRateLimited(account.id)
        if (!isRateLimited) {
          availableAccounts.push({
            ...account,
            accountId: account.id,
            accountType: 'gemini',
            priority: parseInt(account.priority) || 50, // 默认优先级50
            lastUsedAt: account.lastUsedAt || '0'
          })
        }
      }
    }

    logger.info(`📊 Total available Gemini accounts: ${availableAccounts.length}`)
    return availableAccounts
  }

  // 🔢 按优先级和最后使用时间排序账户
  _sortAccountsByPriority(accounts) {
    return accounts.sort((a, b) => {
      // 首先按优先级排序（数字越小优先级越高）
      if (a.priority !== b.priority) {
        return a.priority - b.priority
      }

      // 优先级相同时，按最后使用时间排序（最久未使用的优先）
      const aLastUsed = new Date(a.lastUsedAt || 0).getTime()
      const bLastUsed = new Date(b.lastUsedAt || 0).getTime()
      return aLastUsed - bLastUsed
    })
  }

  // 🔍 检查账户是否可用
  async _isAccountAvailable(accountId, accountType) {
    try {
      if (accountType === 'gemini') {
        const account = await geminiAccountService.getAccount(accountId)
        if (!account || account.isActive !== 'true' || account.status === 'error') {
          return false
        }
        // 检查是否可调度
        if (!this._isSchedulable(account.schedulable)) {
          logger.info(`🚫 Gemini account ${accountId} is not schedulable`)
          return false
        }
        return !(await this.isAccountRateLimited(accountId))
      }
      return false
    } catch (error) {
      logger.warn(`⚠️ Failed to check account availability: ${accountId}`, error)
      return false
    }
  }

  // 🔗 获取会话映射
  async _getSessionMapping(sessionHash) {
    const client = redis.getClientSafe()
    const mappingData = await client.get(`${this.SESSION_MAPPING_PREFIX}${sessionHash}`)

    if (mappingData) {
      try {
        return JSON.parse(mappingData)
      } catch (error) {
        logger.warn('⚠️ Failed to parse session mapping:', error)
        return null
      }
    }

    return null
  }

  // 💾 设置会话映射
  async _setSessionMapping(sessionHash, accountId, accountType) {
    const client = redis.getClientSafe()
    const mappingData = JSON.stringify({ accountId, accountType })
    // 依据配置设置TTL（小时）
    const appConfig = require('../../config/config')
    const ttlHours = appConfig.session?.stickyTtlHours || 1
    const ttlSeconds = Math.max(1, Math.floor(ttlHours * 60 * 60))
    await client.setex(`${this.SESSION_MAPPING_PREFIX}${sessionHash}`, ttlSeconds, mappingData)
  }

  // 🗑️ 删除会话映射
  async _deleteSessionMapping(sessionHash) {
    const client = redis.getClientSafe()
    await client.del(`${this.SESSION_MAPPING_PREFIX}${sessionHash}`)
  }

  // 🔁 续期统一调度会话映射TTL（针对 unified_gemini_session_mapping:* 键），遵循会话配置
  async _extendSessionMappingTTL(sessionHash) {
    try {
      const client = redis.getClientSafe()
      const key = `${this.SESSION_MAPPING_PREFIX}${sessionHash}`
      const remainingTTL = await client.ttl(key)

      if (remainingTTL === -2) {
        return false
      }
      if (remainingTTL === -1) {
        return true
      }

      const appConfig = require('../../config/config')
      const ttlHours = appConfig.session?.stickyTtlHours || 1
      const renewalThresholdMinutes = appConfig.session?.renewalThresholdMinutes || 0
      if (!renewalThresholdMinutes) {
        return true
      }

      const fullTTL = Math.max(1, Math.floor(ttlHours * 60 * 60))
      const threshold = Math.max(0, Math.floor(renewalThresholdMinutes * 60))

      if (remainingTTL < threshold) {
        await client.expire(key, fullTTL)
        logger.debug(
          `🔄 Renewed unified Gemini session TTL: ${sessionHash} (was ${Math.round(remainingTTL / 60)}m, renewed to ${ttlHours}h)`
        )
      } else {
        logger.debug(
          `✅ Unified Gemini session TTL sufficient: ${sessionHash} (remaining ${Math.round(remainingTTL / 60)}m)`
        )
      }
      return true
    } catch (error) {
      logger.error('❌ Failed to extend unified Gemini session TTL:', error)
      return false
    }
  }

  // 🚫 标记账户为限流状态
  async markAccountRateLimited(accountId, accountType, sessionHash = null) {
    try {
      if (accountType === 'gemini') {
        await geminiAccountService.setAccountRateLimited(accountId, true)
      }

      // 删除会话映射
      if (sessionHash) {
        await this._deleteSessionMapping(sessionHash)
      }

      return { success: true }
    } catch (error) {
      logger.error(
        `❌ Failed to mark account as rate limited: ${accountId} (${accountType})`,
        error
      )
      throw error
    }
  }

  // ✅ 移除账户的限流状态
  async removeAccountRateLimit(accountId, accountType) {
    try {
      if (accountType === 'gemini') {
        await geminiAccountService.setAccountRateLimited(accountId, false)
      }

      return { success: true }
    } catch (error) {
      logger.error(
        `❌ Failed to remove rate limit for account: ${accountId} (${accountType})`,
        error
      )
      throw error
    }
  }

  // 🔍 检查账户是否处于限流状态
  async isAccountRateLimited(accountId) {
    try {
      const account = await geminiAccountService.getAccount(accountId)
      if (!account) {
        return false
      }

      if (account.rateLimitStatus === 'limited' && account.rateLimitedAt) {
        const limitedAt = new Date(account.rateLimitedAt).getTime()
        const now = Date.now()
        const limitDuration = 60 * 60 * 1000 // 1小时

        return now < limitedAt + limitDuration
      }
      return false
    } catch (error) {
      logger.error(`❌ Failed to check rate limit status: ${accountId}`, error)
      return false
    }
  }

  // 👥 从分组中选择账户
  async selectAccountFromGroup(groupId, sessionHash = null, requestedModel = null) {
    try {
      // 获取分组信息
      const group = await accountGroupService.getGroup(groupId)
      if (!group) {
        throw new Error(`Group ${groupId} not found`)
      }

      if (group.platform !== 'gemini') {
        throw new Error(`Group ${group.name} is not a Gemini group`)
      }

      logger.info(`👥 Selecting account from Gemini group: ${group.name}`)

      // 如果有会话哈希，检查是否有已映射的账户
      if (sessionHash) {
        const mappedAccount = await this._getSessionMapping(sessionHash)
        if (mappedAccount) {
          // 验证映射的账户是否属于这个分组
          const memberIds = await accountGroupService.getGroupMembers(groupId)
          if (memberIds.includes(mappedAccount.accountId)) {
            const isAvailable = await this._isAccountAvailable(
              mappedAccount.accountId,
              mappedAccount.accountType
            )
            if (isAvailable) {
              // 🚀 智能会话续期（续期 unified 映射键，按配置）
              await this._extendSessionMappingTTL(sessionHash)
              logger.info(
                `🎯 Using sticky session account from group: ${mappedAccount.accountId} (${mappedAccount.accountType}) for session ${sessionHash}`
              )
              // 更新账户的最后使用时间
              await geminiAccountService.markAccountUsed(mappedAccount.accountId)
              return mappedAccount
            }
          }
          // 如果映射的账户不可用或不在分组中，删除映射
          await this._deleteSessionMapping(sessionHash)
        }
      }

      // 获取分组内的所有账户
      const memberIds = await accountGroupService.getGroupMembers(groupId)
      if (memberIds.length === 0) {
        throw new Error(`Group ${group.name} has no members`)
      }

      const availableAccounts = []

      // 获取所有成员账户的详细信息
      for (const memberId of memberIds) {
        const account = await geminiAccountService.getAccount(memberId)

        if (!account) {
          logger.warn(`⚠️ Gemini account ${memberId} not found in group ${group.name}`)
          continue
        }

        // 检查账户是否可用
        if (
          account.isActive === 'true' &&
          account.status !== 'error' &&
          this._isSchedulable(account.schedulable)
        ) {
          // 检查token是否过期
          const isExpired = geminiAccountService.isTokenExpired(account)
          if (isExpired && !account.refreshToken) {
            logger.warn(
              `⚠️ Gemini account ${account.name} in group token expired and no refresh token available`
            )
            continue
          }

          // 检查模型支持
          if (requestedModel && account.supportedModels && account.supportedModels.length > 0) {
            // 处理可能带有 models/ 前缀的模型名
            const normalizedModel = requestedModel.replace('models/', '')
            const modelSupported = account.supportedModels.some(
              (model) => model.replace('models/', '') === normalizedModel
            )
            if (!modelSupported) {
              logger.debug(
                `⏭️ Skipping Gemini account ${account.name} in group - doesn't support model ${requestedModel}`
              )
              continue
            }
          }

          // 检查是否被限流
          const isRateLimited = await this.isAccountRateLimited(account.id)
          if (!isRateLimited) {
            availableAccounts.push({
              ...account,
              accountId: account.id,
              accountType: 'gemini',
              priority: parseInt(account.priority) || 50,
              lastUsedAt: account.lastUsedAt || '0'
            })
          }
        }
      }

      if (availableAccounts.length === 0) {
        throw new Error(`No available accounts in Gemini group ${group.name}`)
      }

      // 🧠 使用智能账户选择器基于余额使用率选择最优账户（分组内）
      const selectedAccount = await intelligentAccountSelector.selectOptimalAccount(
        apiKeyData,
        availableAccounts,
        'gemini',
        requestedModel
      )

      // 如果有会话哈希，建立新的映射
      if (sessionHash) {
        await this._setSessionMapping(
          sessionHash,
          selectedAccount.accountId,
          selectedAccount.accountType
        )
        logger.info(
          `🎯 Created new sticky session mapping in group: ${selectedAccount.name} (${selectedAccount.accountId}, ${selectedAccount.accountType}) for session ${sessionHash}`
        )
      }

      logger.info(
        `🎯 Selected account from Gemini group ${group.name}: ${selectedAccount.name} (${selectedAccount.accountId}, ${selectedAccount.accountType}) with priority ${selectedAccount.priority}`
      )

      // 更新账户的最后使用时间
      await geminiAccountService.markAccountUsed(selectedAccount.accountId)

      return {
        accountId: selectedAccount.accountId,
        accountType: selectedAccount.accountType
      }
    } catch (error) {
      logger.error(`❌ Failed to select account from Gemini group ${groupId}:`, error)
      throw error
    }
  }
}

module.exports = new UnifiedGeminiScheduler()
