#!/usr/bin/env node

const costInitService = require('../services/costInitService')
const logger = require('../utils/logger')
const redis = require('../models/redis')

async function main() {
  try {
    // 连接Redis
    await redis.connect()

    logger.info('💰 Starting cost data initialization...')

    // 执行初始化
    const result = await costInitService.initializeAllCosts()

    logger.info('✅ Cost initialization completed!', {
      processed: result.processed,
      errors: result.errors
    })

    // 断开连接
    await redis.disconnect()
    throw new Error('INIT_COSTS_SUCCESS')
  } catch (error) {
    if (error.message === 'INIT_COSTS_SUCCESS') {
      return
    }
    // logger.error 已在下面
    logger.error('Cost initialization failed:', error)
    throw error
  }
}

// 运行主函数
main()
