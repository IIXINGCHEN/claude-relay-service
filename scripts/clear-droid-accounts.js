#!/usr/bin/env node

/**
 * 清理所有Droid账户数据（用于解决解密错误）
 *
 * 使用场景：
 * 1. ENCRYPTION_KEY已更改，导致旧数据无法解密
 * 2. Droid账户数据损坏
 * 3. 需要重新开始配置Droid账户
 */

const Redis = require('ioredis')
const config = require('../config/config')

async function clearDroidAccounts() {
  console.log('=== 清理 Droid 账户工具 ===\n')

  const redis = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password || undefined,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error('❌ 无法连接到Redis')
        process.exit(1)
      }
      return Math.min(times * 100, 2000)
    }
  })

  try {
    await redis.ping()
    console.log('✅ Redis连接成功\n')

    // 获取所有Droid账户的key
    const keys = await redis.keys('droid:account:*')

    if (keys.length === 0) {
      console.log('未找到任何Droid账户')
      await redis.quit()
      process.exit(0)
    }

    console.log(`找到 ${keys.length} 个Droid账户:\n`)

    // 显示账户信息
    for (const key of keys) {
      const data = await redis.hgetall(key)
      const accountId = key.replace('droid:account:', '')
      console.log(`  - ${data.name || 'Unnamed'} (${accountId})`)
      console.log(`    状态: ${data.status || 'N/A'}`)
      console.log(`    认证方式: ${data.authenticationMethod || 'N/A'}`)
    }

    console.log('\n⚠️  警告：此操作将删除所有Droid账户数据！')
    console.log('如果您想继续，请手动执行：')
    console.log('\n  1. 在Redis CLI中运行：')
    console.log('     redis-cli KEYS "droid:account:*" | xargs redis-cli DEL')
    console.log('\n  2. 或在Node.js中确认删除（修改此脚本）')
    console.log('\n如需自动删除，请取消注释下面的代码块：\n')

    // 取消注释以下代码以执行删除操作
    /*
    console.log('\n开始删除...')
    for (const key of keys) {
      await redis.del(key)
      console.log(`🗑️  已删除: ${key}`)
    }
    console.log(`\n✅ 成功删除 ${keys.length} 个Droid账户`)
    */

    await redis.quit()
  } catch (error) {
    console.error('❌ 错误:', error.message)
    await redis.quit()
    process.exit(1)
  }
}

clearDroidAccounts()
