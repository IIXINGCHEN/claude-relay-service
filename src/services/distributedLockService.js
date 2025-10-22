/**
 * 分布式锁服务
 * 使用Redis实现分布式锁，用于API请求去重和并发控制
 */

const redis = require('../models/redis')
const logger = require('../utils/logger')
const crypto = require('crypto')

class DistributedLockService {
  constructor() {
    // 锁的默认配置
    this.defaultTTL = 30000 // 30秒默认过期时间
    this.defaultRetryDelay = 50 // 50ms重试延迟
    this.defaultRetries = 10 // 默认重试次数
    this.lockPrefix = 'lock:'

    // 存储活动的锁
    this.activeLocks = new Map()

    // 定期清理过期的本地锁记录
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredLocks()
    }, 60000) // 每分钟清理一次

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }
  }

  /**
   * 获取分布式锁
   * @param {string} resource - 资源标识符
   * @param {Object} options - 锁选项
   * @returns {Promise<Object|null>} 锁对象或null
   */
  async acquireLock(resource, options = {}) {
    const {
      ttl = this.defaultTTL,
      retries = this.defaultRetries,
      retryDelay = this.defaultRetryDelay,
      value = crypto.randomBytes(16).toString('hex')
    } = options

    const key = `${this.lockPrefix}${resource}`
    const startTime = Date.now()

    for (let i = 0; i <= retries; i++) {
      try {
        // 使用SET NX EX原子操作
        const result = await redis.client.set(
          key,
          value,
          'PX', // 使用毫秒
          ttl,
          'NX' // 只在键不存在时设置
        )

        if (result === 'OK') {
          const lock = {
            resource,
            key,
            value,
            ttl,
            acquiredAt: Date.now(),
            expiresAt: Date.now() + ttl
          }

          // 存储到本地
          this.activeLocks.set(resource, lock)

          logger.debug(`🔒 Lock acquired: ${resource} (TTL: ${ttl}ms)`)
          return lock
        }

        // 如果获取失败，等待后重试
        if (i < retries) {
          await this.sleep(retryDelay * (i + 1)) // 指数退避
        }
      } catch (error) {
        logger.error(`Error acquiring lock for ${resource}:`, error)
        if (i === retries) {
          throw error
        }
      }
    }

    const elapsed = Date.now() - startTime
    logger.warn(`⏱️ Failed to acquire lock for ${resource} after ${retries} retries (${elapsed}ms)`)
    return null
  }

  /**
   * 释放分布式锁
   * @param {Object} lock - 锁对象
   * @returns {Promise<boolean>} 是否成功释放
   */
  async releaseLock(lock) {
    if (!lock || !lock.key || !lock.value) {
      return false
    }

    try {
      // 使用Lua脚本确保原子性：只有锁的持有者才能释放
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `

      const result = await redis.client.eval(luaScript, 1, lock.key, lock.value)

      if (result === 1) {
        // 从本地移除
        this.activeLocks.delete(lock.resource)
        logger.debug(`🔓 Lock released: ${lock.resource}`)
        return true
      } else {
        logger.warn(`⚠️ Failed to release lock: ${lock.resource} (not owner or expired)`)
        return false
      }
    } catch (error) {
      logger.error(`Error releasing lock for ${lock.resource}:`, error)
      return false
    }
  }

  /**
   * 延长锁的过期时间
   * @param {Object} lock - 锁对象
   * @param {number} ttl - 新的TTL（毫秒）
   * @returns {Promise<boolean>} 是否成功延长
   */
  async extendLock(lock, ttl = null) {
    if (!lock || !lock.key || !lock.value) {
      return false
    }

    const newTTL = ttl || lock.ttl || this.defaultTTL

    try {
      // 使用Lua脚本确保原子性：只有锁的持有者才能延长
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("pexpire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `

      const result = await redis.client.eval(luaScript, 1, lock.key, lock.value, newTTL)

      if (result === 1) {
        lock.expiresAt = Date.now() + newTTL
        logger.debug(`⏰ Lock extended: ${lock.resource} (new TTL: ${newTTL}ms)`)
        return true
      } else {
        logger.warn(`⚠️ Failed to extend lock: ${lock.resource} (not owner or expired)`)
        return false
      }
    } catch (error) {
      logger.error(`Error extending lock for ${lock.resource}:`, error)
      return false
    }
  }

  /**
   * 检查锁是否被持有
   * @param {string} resource - 资源标识符
   * @returns {Promise<boolean>} 是否被锁定
   */
  async isLocked(resource) {
    const key = `${this.lockPrefix}${resource}`

    try {
      const exists = await redis.client.exists(key)
      return exists === 1
    } catch (error) {
      logger.error(`Error checking lock for ${resource}:`, error)
      return false
    }
  }

  /**
   * 获取锁的剩余TTL
   * @param {string} resource - 资源标识符
   * @returns {Promise<number>} TTL（毫秒），-1表示不存在，-2表示没有TTL
   */
  async getLockTTL(resource) {
    const key = `${this.lockPrefix}${resource}`

    try {
      const ttl = await redis.client.pttl(key)
      return ttl
    } catch (error) {
      logger.error(`Error getting TTL for ${resource}:`, error)
      return -1
    }
  }

  /**
   * 使用锁执行函数
   * @param {string} resource - 资源标识符
   * @param {Function} fn - 要执行的函数
   * @param {Object} options - 锁选项
   * @returns {Promise<*>} 函数执行结果
   */
  async withLock(resource, fn, options = {}) {
    const lock = await this.acquireLock(resource, options)

    if (!lock) {
      throw new Error(`Failed to acquire lock for ${resource}`)
    }

    try {
      // 如果函数执行时间可能超过TTL，设置自动延长
      const { autoExtend = true, extendInterval = lock.ttl / 3 } = options
      let extendTimer = null

      if (autoExtend && extendInterval > 0) {
        extendTimer = setInterval(async () => {
          const extended = await this.extendLock(lock)
          if (!extended) {
            clearInterval(extendTimer)
            logger.warn(`⚠️ Failed to auto-extend lock: ${resource}`)
          }
        }, extendInterval)

        if (extendTimer.unref) {
          extendTimer.unref()
        }
      }

      // 执行函数
      const result = await fn()

      // 清理定时器
      if (extendTimer) {
        clearInterval(extendTimer)
      }

      return result
    } finally {
      // 确保锁被释放
      await this.releaseLock(lock)
    }
  }

  /**
   * 批量获取锁
   * @param {Array<string>} resources - 资源标识符数组
   * @param {Object} options - 锁选项
   * @returns {Promise<Array>} 锁对象数组
   */
  async acquireMultipleLocks(resources, options = {}) {
    const locks = []

    for (const resource of resources) {
      const lock = await this.acquireLock(resource, options)
      if (lock) {
        locks.push(lock)
      } else {
        // 如果任何一个锁获取失败，释放已获取的锁
        for (const acquiredLock of locks) {
          await this.releaseLock(acquiredLock)
        }
        return []
      }
    }

    return locks
  }

  /**
   * 批量释放锁
   * @param {Array} locks - 锁对象数组
   * @returns {Promise<number>} 成功释放的数量
   */
  async releaseMultipleLocks(locks) {
    let released = 0

    for (const lock of locks) {
      if (await this.releaseLock(lock)) {
        released++
      }
    }

    return released
  }

  /**
   * 清理过期的本地锁记录
   * @private
   */
  cleanupExpiredLocks() {
    const now = Date.now()
    let cleaned = 0

    for (const [resource, lock] of this.activeLocks.entries()) {
      if (now > lock.expiresAt) {
        this.activeLocks.delete(resource)
        cleaned++
      }
    }

    if (cleaned > 0) {
      logger.debug(`🧹 Cleaned ${cleaned} expired local lock records`)
    }
  }

  /**
   * 强制释放所有锁（用于关闭时清理）
   */
  async releaseAllLocks() {
    const locks = Array.from(this.activeLocks.values())
    const released = await this.releaseMultipleLocks(locks)
    this.activeLocks.clear()

    if (released > 0) {
      logger.info(`🔓 Released ${released} locks during cleanup`)
    }

    // 清理定时器
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }

  /**
   * 睡眠函数
   * @private
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      activeLocks: this.activeLocks.size,
      locks: Array.from(this.activeLocks.keys())
    }
  }
}

// 导出单例
module.exports = new DistributedLockService()
