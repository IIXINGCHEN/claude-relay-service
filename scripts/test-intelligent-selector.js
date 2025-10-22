#!/usr/bin/env node

/**
 * 智能账户选择器测试脚本
 * 用于测试基于余额使用率的账户选择功能
 */

const logger = require('../src/utils/logger')
const intelligentAccountSelector = require('../src/services/intelligentAccountSelector')

async function testIntelligentSelector() {
  logger.info('🧠 开始测试智能账户选择器...')

  try {
    // 1. 测试获取选择器状态
    logger.info('📊 测试选择器状态...')
    const status = intelligentAccountSelector.getCacheStats()
    logger.info('   缓存状态:', status)

    // 2. 模拟API Key数��
    const mockApiKeyData = {
      id: 'test-api-key',
      name: 'Test API Key',
      isActive: true
    }

    // 3. 模拟账户数据
    const mockAccounts = [
      {
        accountId: 'account-1',
        name: 'Low Usage Account',
        accountType: 'openai',
        priority: 50,
        lastUsedAt: '2024-12-20T10:00:00Z',
        isActive: true,
        schedulable: true
      },
      {
        accountId: 'account-2',
        name: 'High Usage Account',
        accountType: 'openai',
        priority: 80,
        lastUsedAt: '2024-12-22T15:30:00Z',
        isActive: true,
        schedulable: true
      },
      {
        accountId: 'account-3',
        name: 'Medium Usage Account',
        accountType: 'openai',
        priority: 60,
        lastUsedAt: '2024-12-21T08:15:00Z',
        isActive: true,
        schedulable: true
      }
    ]

    logger.info(`🔍 测试账户选择，共 ${mockAccounts.length} 个模拟账户`)

    // 4. 测试账户选择（可能会因为没有真实的Redis数据而降级到随机选择）
    const selectedAccount = await intelligentAccountSelector.selectOptimalAccount(
      mockApiKeyData,
      mockAccounts,
      'openai',
      'gpt-4'
    )

    logger.success('✅ 账户选择完成:')
    logger.info(`   选中账户: ${selectedAccount.name}`)
    logger.info(`   账户ID: ${selectedAccount.accountId}`)
    logger.info(`   账户类型: ${selectedAccount.accountType}`)
    logger.info(`   优先级: ${selectedAccount.priority}`)

    // 5. 测试缓存清理
    logger.info('🧹 测试缓存清理...')
    intelligentAccountSelector.clearAccountCache('test-account', 'openai')
    logger.info('   单个账户缓存清理完成')

    // 6. 测试分组功能
    logger.info('📊 测试账户分组功能...')
    const accountsWithBalance = await intelligentAccountSelector._enrichAccountsWithBalance(
      mockAccounts,
      'openai'
    )

    logger.info(`   成功为 ${accountsWithBalance.length} 个账户添加余额信息`)

    accountsWithBalance.forEach(account => {
      logger.info(`   - ${account.name}: 使用率 ${((account.usagePercentage || 0) * 100).toFixed(1)}%`)
    })

    logger.success('🎉 智能账户选择器测试完成!')

  } catch (error) {
    logger.error('❌ 测试失败:', error.message)
    logger.error('详细错误:', error)
    process.exit(1)
  }
}

// 运行测试
if (require.main === module) {
  testIntelligentSelector()
    .then(() => {
      logger.info('✅ 所有测试通过')
      process.exit(0)
    })
    .catch((error) => {
      logger.error('❌ 测试失败:', error)
      process.exit(1)
    })
}

module.exports = { testIntelligentSelector }