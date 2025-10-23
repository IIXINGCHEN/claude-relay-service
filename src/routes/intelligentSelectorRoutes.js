const express = require('express')
const router = express.Router()
const logger = require('../utils/logger')
const intelligentAccountSelector = require('../services/intelligentAccountSelector')
const redis = require('../models/redis')

/**
 * 获取智能账户选择器的配置和统计信息
 */
router.get('/status', async (req, res) => {
  try {
    const cacheStats = intelligentAccountSelector.getCacheStats()

    res.json({
      success: true,
      data: {
        name: 'Intelligent Account Selector',
        description: '基于余额使用率的智能账户选择器',
        version: '1.0.0',
        cache: cacheStats,
        thresholds: {
          low: '30% 以下',
          medium: '30% - 50%',
          high: '50% - 80%',
          critical: '80% 以上'
        },
        selectionStrategy: '优先选择余额使用率较低的账户，确保账户负载均衡',
        features: [
          '实时余额监控',
          '智能分组选择',
          '多维度负载均衡',
          '自动缓存优化',
          '降级保护机制'
        ]
      }
    })
  } catch (error) {
    logger.error('Failed to get intelligent selector status:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get selector status',
      message: error.message
    })
  }
})

/**
 * 获取指定平台的账户余额分布情况
 */
router.get('/balance-distribution/:platform', async (req, res) => {
  try {
    const { platform } = req.params
    const validPlatforms = ['openai', 'claude', 'gemini']

    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid platform',
        message: `Platform must be one of: ${validPlatforms.join(', ')}`
      })
    }

    // 获取该平台的所有账户
    let accounts = []

    switch (platform) {
      case 'openai':
        const openaiAccountService = require('../services/openaiAccountService')
        accounts = await openaiAccountService.getAllAccounts()
        break
      case 'claude':
        const claudeAccountService = require('../services/claudeAccountService')
        accounts = await claudeAccountService.getAllAccounts()
        break
      case 'gemini':
        const geminiAccountService = require('../services/geminiAccountService')
        accounts = await geminiAccountService.getAllAccounts()
        break
    }

    // 过滤活跃账户
    const activeAccounts = accounts.filter(account =>
      account.isActive && account.status !== 'error' &&
      (account.accountType === 'shared' || !account.accountType)
    )

    // 获取余额信息
    const accountsWithBalance = await intelligentAccountSelector._enrichAccountsWithBalance(
      activeAccounts,
      platform
    )

    // 按使用率分组统计
    const distribution = {
      low: { count: 0, accounts: [] },      // < 30%
      medium: { count: 0, accounts: [] },   // 30% - 50%
      high: { count: 0, accounts: [] },     // 50% - 80%
      critical: { count: 0, accounts: [] }  // > 80%
    }

    const threshold = intelligentAccountSelector.usageThresholds

    for (const account of accountsWithBalance) {
      const usage = account.usagePercentage || 0
      const accountInfo = {
        id: account.id,
        name: account.name,
        usagePercentage: Math.round(usage * 100),
        totalCost: account.totalCost || 0,
        estimatedLimit: account.estimatedLimit || 0,
        lastUsedAt: account.lastUsedAt,
        priority: account.priority || 50
      }

      if (usage < threshold.low) {
        distribution.low.count++
        distribution.low.accounts.push(accountInfo)
      } else if (usage < threshold.medium) {
        distribution.medium.count++
        distribution.medium.accounts.push(accountInfo)
      } else if (usage < threshold.high) {
        distribution.high.count++
        distribution.high.accounts.push(accountInfo)
      } else {
        distribution.critical.count++
        distribution.critical.accounts.push(accountInfo)
      }
    }

    res.json({
      success: true,
      data: {
        platform,
        totalAccounts: activeAccounts.length,
        distribution,
        summary: {
          healthyAccounts: distribution.low.count + distribution.medium.count,
          busyAccounts: distribution.high.count,
          criticalAccounts: distribution.critical.count,
          healthScore: activeAccounts.length > 0
            ? Math.round(((distribution.low.count + distribution.medium.count) / activeAccounts.length) * 100)
            : 0
        }
      }
    })

  } catch (error) {
    logger.error(`Failed to get balance distribution for platform ${req.params.platform}:`, error)
    res.status(500).json({
      success: false,
      error: 'Failed to get balance distribution',
      message: error.message
    })
  }
})

/**
 * 清除指定账户的余额缓存
 */
router.post('/clear-cache/:platform/:accountId', async (req, res) => {
  try {
    const { platform, accountId } = req.params
    const validPlatforms = ['openai', 'claude', 'gemini']

    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid platform',
        message: `Platform must be one of: ${validPlatforms.join(', ')}`
      })
    }

    intelligentAccountSelector.clearAccountCache(accountId, platform)

    logger.info(`Cleared balance cache for account ${accountId} (${platform})`)

    res.json({
      success: true,
      message: `Cache cleared for account ${accountId} (${platform})`
    })

  } catch (error) {
    logger.error(`Failed to clear cache for account ${req.params.accountId}:`, error)
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error.message
    })
  }
})

/**
 * 清除所有余额缓存
 */
router.post('/clear-all-cache', async (req, res) => {
  try {
    // 通过重新初始化选择器来清除所有缓存
    const currentCache = intelligentAccountSelector.getCacheStats()
    const clearedCount = currentCache.size

    // 清除缓存（这里需要在选择器中实现清除所有缓存的方法）
    for (const [key] of intelligentAccountSelector.balanceCache.entries()) {
      intelligentAccountSelector.balanceCache.delete(key)
    }

    logger.info(`Cleared all balance cache (${clearedCount} entries)`)

    res.json({
      success: true,
      message: `Cleared all balance cache (${clearedCount} entries)`,
      clearedCount
    })

  } catch (error) {
    logger.error('Failed to clear all cache:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to clear all cache',
      message: error.message
    })
  }
})

/**
 * 模拟账户选择过程（用于测试和调试）
 */
router.post('/simulate-selection', async (req, res) => {
  try {
    const { platform, apiKeyData, requestedModel } = req.body

    if (!platform || !apiKeyData) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        message: 'platform and apiKeyData are required'
      })
    }

    const validPlatforms = ['openai', 'claude', 'gemini']

    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid platform',
        message: `Platform must be one of: ${validPlatforms.join(', ')}`
      })
    }

    // 获取可用账户
    let availableAccounts = []

    switch (platform) {
      case 'openai':
        const openaiAccountService = require('../services/openaiAccountService')
        const openaiAccounts = await openaiAccountService.getAllAccounts()
        availableAccounts = openaiAccounts.filter(account =>
          account.isActive && account.status !== 'error' &&
          (account.accountType === 'shared' || !account.accountType)
        ).map(account => ({
          accountId: account.id,
          accountType: 'openai',
          name: account.name,
          priority: account.priority || 50,
          lastUsedAt: account.lastUsedAt,
          isActive: account.isActive,
          schedulable: account.schedulable
        }))
        break
      case 'claude':
        const claudeAccountService = require('../services/claudeAccountService')
        const claudeAccounts = await claudeAccountService.getAllAccounts()
        availableAccounts = claudeAccounts.filter(account =>
          account.isActive && account.status !== 'error' &&
          (account.accountType === 'shared' || !account.accountType)
        ).map(account => ({
          accountId: account.id,
          accountType: 'claude-official',
          name: account.name,
          priority: account.priority || 50,
          lastUsedAt: account.lastUsedAt,
          isActive: account.isActive,
          schedulable: account.schedulable
        }))
        break
      case 'gemini':
        const geminiAccountService = require('../services/geminiAccountService')
        const geminiAccounts = await geminiAccountService.getAllAccounts()
        availableAccounts = geminiAccounts.filter(account =>
          account.isActive && account.status !== 'error' &&
          (account.accountType === 'shared' || !account.accountType)
        ).map(account => ({
          accountId: account.id,
          accountType: 'gemini',
          name: account.name,
          priority: account.priority || 50,
          lastUsedAt: account.lastUsedAt,
          isActive: account.isActive,
          schedulable: account.schedulable
        }))
        break
    }

    if (availableAccounts.length === 0) {
      return res.json({
        success: true,
        data: {
          platform,
          availableAccounts: 0,
          message: 'No available accounts found for simulation',
          selectionProcess: []
        }
      })
    }

    // 执行智能选择
    const selectedAccount = await intelligentAccountSelector.selectOptimalAccount(
      apiKeyData,
      availableAccounts,
      platform,
      requestedModel
    )

    // 获取详细的账户余额信息
    const accountsWithBalance = await intelligentAccountSelector._enrichAccountsWithBalance(
      availableAccounts,
      platform
    )

    res.json({
      success: true,
      data: {
        platform,
        requestedModel: requestedModel || 'any',
        availableAccounts: availableAccounts.length,
        selectedAccount: {
          id: selectedAccount.accountId,
          name: selectedAccount.name,
          accountType: selectedAccount.accountType,
          usagePercentage: Math.round((selectedAccount.usagePercentage || 0) * 100),
          totalCost: selectedAccount.totalCost || 0,
          estimatedLimit: selectedAccount.estimatedLimit || 0,
          priority: selectedAccount.priority || 50,
          lastUsedAt: selectedAccount.lastUsedAt
        },
        allAccounts: accountsWithBalance.map(account => ({
          id: account.accountId,
          name: account.name,
          usagePercentage: Math.round((account.usagePercentage || 0) * 100),
          totalCost: account.totalCost || 0,
          estimatedLimit: account.estimatedLimit || 0,
          priority: account.priority || 50,
          lastUsedAt: account.lastUsedAt,
          isSelected: account.accountId === selectedAccount.accountId
        })),
        selectionReason: `Selected account with ${(selectedAccount.usagePercentage || 0) * 100}% usage rate`
      }
    })

  } catch (error) {
    logger.error('Failed to simulate account selection:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to simulate selection',
      message: error.message
    })
  }
})

module.exports = router