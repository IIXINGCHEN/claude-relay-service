const logger = require('../utils/logger')
const redis = require('../models/redis')
const pricingService = require('./pricingService')
const { formatDateWithTimezone } = require('../utils/dateHelper')

/**
 * 智能账户选择器
 * 基于账户余额使用率优先选择余额较少的账户
 * 策略：<30% -> <50% -> <80% -> >=80%
 */
class IntelligentAccountSelector {
  constructor() {
    // 余额使用率阈值配置
    this.usageThresholds = {
      low: 0.3,    // 30% 以下为低使用率
      medium: 0.5, // 50% 以下为中等使用率
      high: 0.8    // 80% 以下为高使用率
    }

    // 缓存配置（5分钟）
    this.cacheTTL = 5 * 60 * 1000
    this.balanceCache = new Map()

    // 定期清理缓存
    setInterval(() => {
      this._cleanExpiredCache()
    }, 60 * 1000) // 每分钟清理一次
  }

  /**
   * 为API Key选择最优账户
   * @param {Object} apiKeyData - API Key数据
   * @param {Array} availableAccounts - 可用账户列表
   * @param {string} platform - 平台类型 ('openai', 'claude', 'gemini'等)
   * @param {string} requestedModel - 请求的模���
   * @returns {Object} 选中的账户
   */
  async selectOptimalAccount(apiKeyData, availableAccounts, platform, requestedModel = null) {
    if (!availableAccounts || availableAccounts.length === 0) {
      throw new Error('No available accounts to select from')
    }

    // 如果只有一个账户，直接返回
    if (availableAccounts.length === 1) {
      logger.debug(`Only one available account for ${platform}, using it directly`)
      return availableAccounts[0]
    }

    try {
      // 获取所有账户的余额使用率
      const accountsWithBalance = await this._enrichAccountsWithBalance(
        availableAccounts,
        platform
      )

      // 按余额使用率分组
      const groupedAccounts = this._groupAccountsByUsage(accountsWithBalance)

      // 记录选择过程的详细信息
      logger.info(`📊 Account selection for ${platform} - API Key: ${apiKeyData.name || apiKeyData.id}`)
      logger.info(`   Available accounts: ${accountsWithBalance.length}`)
      logger.info(`   Low usage (<30%): ${groupedAccounts.low.length}`)
      logger.info(`   Medium usage (30-50%): ${groupedAccounts.medium.length}`)
      logger.info(`   High usage (50-80%): ${groupedAccounts.high.length}`)
      logger.info(`   Critical usage (>80%): ${groupedAccounts.critical.length}`)

      // 按优先级选择账户
      const selectedAccount = this._selectFromGroups(groupedAccounts, platform, requestedModel)

      if (!selectedAccount) {
        throw new Error('Failed to select account from available options')
      }

      logger.info(`✅ Selected account: ${selectedAccount.name || selectedAccount.id} (${platform}) - Usage: ${(selectedAccount.usagePercentage * 100).toFixed(1)}%`)

      return selectedAccount

    } catch (error) {
      logger.error(`❌ Error in intelligent account selection for ${platform}:`, error.message)

      // 降级到随机选择
      const fallbackAccount = availableAccounts[Math.floor(Math.random() * availableAccounts.length)]
      logger.warn(`⚠️ Fallback to random selection: ${fallbackAccount.name || fallbackAccount.id}`)
      return fallbackAccount
    }
  }

  /**
   * 为账户添加余额使用率信息
   * @param {Array} accounts - 账户列表
   * @param {string} platform - 平台类型
   * @returns {Array} 带余额信息的账户列表
   */
  async _enrichAccountsWithBalance(accounts, platform) {
    const enrichedAccounts = []

    for (const account of accounts) {
      try {
        // 检查缓存
        const cacheKey = `${platform}:${account.id}`
        const cached = this.balanceCache.get(cacheKey)

        if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
          enrichedAccounts.push({
            ...account,
            usagePercentage: cached.usagePercentage,
            totalCost: cached.totalCost,
            estimatedLimit: cached.estimatedLimit
          })
          continue
        }

        // 获取账户的实际使用统计
        const usageStats = await this._getAccountUsageStats(account.id, platform)
        const usagePercentage = await this._calculateUsagePercentage(usageStats, account, platform)

        const enrichedAccount = {
          ...account,
          usagePercentage,
          totalCost: usageStats.totalCost || 0,
          estimatedLimit: usageStats.estimatedLimit || 0
        }

        // 缓存结果
        this.balanceCache.set(cacheKey, {
          usagePercentage,
          totalCost: usageStats.totalCost || 0,
          estimatedLimit: usageStats.estimatedLimit || 0,
          timestamp: Date.now()
        })

        enrichedAccounts.push(enrichedAccount)

      } catch (error) {
        logger.warn(`⚠️ Failed to get balance info for account ${account.id}: ${error.message}`)
        // 使用默认值（假设使用率为50%）
        enrichedAccounts.push({
          ...account,
          usagePercentage: 0.5,
          totalCost: 0,
          estimatedLimit: 0
        })
      }
    }

    return enrichedAccounts
  }

  /**
   * 获取账户使用统计
   * @param {string} accountId - 账户ID
   * @param {string} platform - 平台类型
   * @returns {Object} 使用统计信息
   */
  async _getAccountUsageStats(accountId, platform) {
    try {
      const client = redis.getClient()

      // 获取当前月份的使用量
      const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM
      const monthlyCostKey = `account_usage:cost:monthly:${accountId}:${currentMonth}`
      const totalCostKey = `account_usage:cost:total:${accountId}`

      const [monthlyCost, totalCost] = await Promise.all([
        client.get(monthlyCostKey),
        client.get(totalCostKey)
      ])

      const monthlyCostNum = parseFloat(monthlyCost || 0)
      const totalCostNum = parseFloat(totalCost || 0)

      // 获取账户的估计限额（基于账户类型和订阅信息）
      const estimatedLimit = await this._estimateAccountLimit(accountId, platform)

      return {
        monthlyCost: monthlyCostNum,
        totalCost: totalCostNum,
        estimatedLimit
      }

    } catch (error) {
      logger.warn(`Failed to get usage stats for account ${accountId}: ${error.message}`)
      return {
        monthlyCost: 0,
        totalCost: 0,
        estimatedLimit: 0
      }
    }
  }

  /**
   * 估算账户限额
   * @param {string} accountId - 账户ID
   * @param {string} platform - 平台类型
   * @returns {number} 估计的月度限额（美元）
   */
  async _estimateAccountLimit(accountId, platform) {
    try {
      // 根据平台类型获取账户信息
      let account = null

      switch (platform) {
        case 'openai':
          const openaiAccountService = require('./openaiAccountService')
          account = await openaiAccountService.getAccount(accountId)
          break
        case 'claude':
          const claudeAccountService = require('./claudeAccountService')
          account = await claudeAccountService.getAccount(accountId)
          break
        case 'gemini':
          const geminiAccountService = require('./geminiAccountService')
          account = await geminiAccountService.getAccount(accountId)
          break
        default:
          logger.warn(`Unknown platform for limit estimation: ${platform}`)
          return 100 // 默认100美元限额
      }

      if (!account) {
        logger.warn(`Account not found for limit estimation: ${accountId}`)
        return 100
      }

      // 基于账户类型和订阅信息估算限额
      let estimatedLimit = 100 // 默认限额

      if (platform === 'claude' && account.subscriptionInfo) {
        try {
          const subscriptionInfo = typeof account.subscriptionInfo === 'string'
            ? JSON.parse(account.subscriptionInfo)
            : account.subscriptionInfo

          // Claude账户限额估算
          if (subscriptionInfo.accountType === 'claude_max' || subscriptionInfo.hasClaudeMax) {
            estimatedLimit = 500 // Max账户：约500美元/月
          } else if (subscriptionInfo.accountType === 'claude_pro' || subscriptionInfo.hasClaudePro) {
            estimatedLimit = 200 // Pro账户：约200美元/月
          } else {
            estimatedLimit = 50 // Free/Basic账户：约50美元/月
          }
        } catch (e) {
          logger.debug(`Failed to parse subscription info for account ${accountId}`)
        }
      } else if (platform === 'openai') {
        // OpenAI账户限额估算（基于账户类型）
        if (account.accountType === 'dedicated') {
          estimatedLimit = 1000 // 专属账户：约1000美元/月
        } else {
          estimatedLimit = 200 // 共享账户：约200美元/月
        }
      } else if (platform === 'gemini') {
        // Gemini账户限额估算
        estimatedLimit = 150 // 标准限额
      }

      return estimatedLimit

    } catch (error) {
      logger.warn(`Failed to estimate limit for account ${accountId}: ${error.message}`)
      return 100
    }
  }

  /**
   * 计算账户使用率
   * @param {Object} usageStats - 使用统计
   * @param {Object} account - 账户信息
   * @param {string} platform - 平台类型
   * @returns {number} 使用率（0-1之间）
   */
  async _calculateUsagePercentage(usageStats, account, platform) {
    if (!usageStats.estimatedLimit || usageStats.estimatedLimit <= 0) {
      return 0.5 // 如果没有限额信息，假设50%使用率
    }

    // 使用月度使用量计算使用率
    const monthlyUsage = usageStats.monthlyCost || usageStats.totalCost || 0
    const usagePercentage = Math.min(monthlyUsage / usageStats.estimatedLimit, 1.0)

    // 确保返回值在0-1之间
    return Math.max(0, Math.min(1, usagePercentage))
  }

  /**
   * 按使用率对账户进行分组
   * @param {Array} accounts - 带余额信息的账户列表
   * @returns {Object} 分组后的账户
   */
  _groupAccountsByUsage(accounts) {
    const groups = {
      low: [],      // < 30%
      medium: [],   // 30% - 50%
      high: [],     // 50% - 80%
      critical: []  // > 80%
    }

    for (const account of accounts) {
      const usage = account.usagePercentage || 0

      if (usage < this.usageThresholds.low) {
        groups.low.push(account)
      } else if (usage < this.usageThresholds.medium) {
        groups.medium.push(account)
      } else if (usage < this.usageThresholds.high) {
        groups.high.push(account)
      } else {
        groups.critical.push(account)
      }
    }

    return groups
  }

  /**
   * 从分组中选择最优账户
   * @param {Object} groups - 分组后的账户
   * @param {string} platform - 平台类型
   * @param {string} requestedModel - 请求的模型
   * @returns {Object} 选中的账户
   */
  _selectFromGroups(groups, platform, requestedModel) {
    // 按优先级选择：low -> medium -> high -> critical
    const priorityGroups = [groups.low, groups.medium, groups.high, groups.critical]

    for (const group of priorityGroups) {
      if (group.length === 0) continue

      let selectedAccount

      if (group.length === 1) {
        selectedAccount = group[0]
      } else {
        // 在同一组内，选择优先级最高或最近最少使用的账户
        selectedAccount = this._selectFromSameGroup(group, platform)
      }

      if (selectedAccount) {
        logger.debug(`Selected account from ${this._getGroupName(group, groups)} usage group`)
        return selectedAccount
      }
    }

    return null
  }

  /**
   * 从同一使用率组内选择账户
   * @param {Array} accounts - 同一组的账户
   * @param {string} platform - 平台类型
   * @returns {Object} 选中的账户
   */
  _selectFromSameGroup(accounts, platform) {
    // 多维度选择策略
    // 1. 优先级高的账户优先
    // 2. 相同优先级时，选择最近最少使用的
    // 3. 如果都有相同的使用情况，随机选择

    // 按优先级排序（优先级数字越大越优先）
    const sortedByPriority = [...accounts].sort((a, b) => {
      const priorityA = parseInt(a.priority) || 50
      const priorityB = parseInt(b.priority) || 50
      return priorityB - priorityA
    })

    // 取优先级最高的账户
    const highestPriority = sortedByPriority[0].priority || 50
    const highestPriorityAccounts = sortedByPriority.filter(
      account => (parseInt(account.priority) || 50) === highestPriority
    )

    if (highestPriorityAccounts.length === 1) {
      return highestPriorityAccounts[0]
    }

    // 在优先级相同的账户中，选择最近最少使用的
    const sortedByLastUsed = highestPriorityAccounts.sort((a, b) => {
      const lastUsedA = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0
      const lastUsedB = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0
      return lastUsedA - lastUsedB
    })

    return sortedByLastUsed[0]
  }

  /**
   * 获取组名称
   * @param {Array} group - 组
   * @param {Object} allGroups - 所有组
   * @returns {string} 组名称
   */
  _getGroupName(group, allGroups) {
    if (group === allGroups.low) return 'low'
    if (group === allGroups.medium) return 'medium'
    if (group === allGroups.high) return 'high'
    if (group === allGroups.critical) return 'critical'
    return 'unknown'
  }

  /**
   * 清理过期的缓存
   */
  _cleanExpiredCache() {
    const now = Date.now()
    const expiredKeys = []

    for (const [key, value] of this.balanceCache.entries()) {
      if (now - value.timestamp > this.cacheTTL) {
        expiredKeys.push(key)
      }
    }

    for (const key of expiredKeys) {
      this.balanceCache.delete(key)
    }

    if (expiredKeys.length > 0) {
      logger.debug(`Cleaned ${expiredKeys.length} expired account balance cache entries`)
    }
  }

  /**
   * 强制清除指定账户的缓存
   * @param {string} accountId - 账户ID
   * @param {string} platform - 平台类型
   */
  clearAccountCache(accountId, platform) {
    const cacheKey = `${platform}:${accountId}`
    this.balanceCache.delete(cacheKey)
    logger.debug(`Cleared balance cache for account ${accountId} (${platform})`)
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    return {
      size: this.balanceCache.size,
      ttl: this.cacheTTL,
      thresholds: this.usageThresholds
    }
  }
}

module.exports = new IntelligentAccountSelector()