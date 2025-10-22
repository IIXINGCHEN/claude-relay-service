/**
 * 全局速率限制中间件
 * 防止API滥用和DDoS攻击
 */

const { RateLimiterRedis } = require('rate-limiter-flexible')
const redisClient = require('../models/redis')
const logger = require('../utils/logger')
const { StandardResponses } = require('../utils/standardResponses')
const config = require('../../config/config')

// 创建不同级别的速率限制器
const rateLimiters = {
  // 全局限制（每IP）
  global: new RateLimiterRedis({
    storeClient: redisClient.getClient(),
    keyPrefix: 'rl:global',
    points: 1000, // 每分钟1000次请求
    duration: 60, // 60秒
    blockDuration: 60, // 封禁60秒
    execEvenly: true // 平滑分布
  }),

  // API密钥限制
  apiKey: new RateLimiterRedis({
    storeClient: redisClient.getClient(),
    keyPrefix: 'rl:apikey',
    points: 500, // 每分钟500次请求
    duration: 60,
    blockDuration: 300 // 封禁5分钟
  }),

  // 严格限制（用于敏感端点）
  strict: new RateLimiterRedis({
    storeClient: redisClient.getClient(),
    keyPrefix: 'rl:strict',
    points: 10, // 每分钟10次请求
    duration: 60,
    blockDuration: 600 // 封禁10分钟
  }),

  // 登录尝试限制
  auth: new RateLimiterRedis({
    storeClient: redisClient.getClient(),
    keyPrefix: 'rl:auth',
    points: 5, // 5次尝试
    duration: 900, // 15分钟
    blockDuration: 900 // 封禁15分钟
  }),

  // 慢速限制（用于大请求）
  slow: new RateLimiterRedis({
    storeClient: redisClient.getClient(),
    keyPrefix: 'rl:slow',
    points: 100, // 每小时100次请求
    duration: 3600, // 1小时
    blockDuration: 3600 // 封禁1小时
  })
}

/**
 * 创建速率限制中间件
 * @param {string} type - 限制类型 ('global', 'apiKey', 'strict', 'auth', 'slow')
 * @param {Object} options - 可选配置
 */
function createRateLimitMiddleware(type = 'global', options = {}) {
  const limiter = rateLimiters[type] || rateLimiters.global
  
  return async (req, res, next) => {
    // 跳过健康检查等端点
    if (options.skipPaths && options.skipPaths.includes(req.path)) {
      return next()
    }

    // 生产环境才启用
    if (config.nodeEnv !== 'production' && !options.forceEnable) {
      return next()
    }

    try {
      // 生成限制键
      let key = req.ip
      
      if (type === 'apiKey' && req.apiKey) {
        key = req.apiKey.id
      } else if (type === 'auth') {
        // 使用用户名或IP
        key = req.body?.username || req.ip
      }

      // 消费限制点
      const rateLimitRes = await limiter.consume(key, options.points || 1)
      
      // 添加限制信息到响应头
      res.setHeader('X-RateLimit-Limit', limiter.points)
      res.setHeader('X-RateLimit-Remaining', rateLimitRes.remainingPoints)
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimitRes.msBeforeNext).toISOString())
      
      // 记录接近限制的警告
      if (rateLimitRes.remainingPoints < limiter.points * 0.2) {
        logger.warn(`⚠️ Rate limit warning for ${key}: ${rateLimitRes.remainingPoints} points remaining`)
      }
      
      next()
    } catch (rateLimitRes) {
      // 速率限制超出
      const retryAfter = Math.round(rateLimitRes.msBeforeNext / 1000) || 60
      
      logger.warn(`🚫 Rate limit exceeded for ${req.ip}`, {
        type,
        key: req.ip,
        endpoint: req.path,
        remainingPoints: rateLimitRes.remainingPoints || 0,
        retryAfter
      })
      
      // 设置标准响应头
      res.setHeader('X-RateLimit-Limit', limiter.points)
      res.setHeader('X-RateLimit-Remaining', 0)
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimitRes.msBeforeNext).toISOString())
      res.setHeader('Retry-After', retryAfter)
      
      // 返回标准错误响应
      return StandardResponses.rateLimited(res, retryAfter, 
        options.message || `请求过于频繁，请${retryAfter}秒后重试`)
    }
  }
}

/**
 * 重置特定键的速率限制
 */
async function resetRateLimit(type, key) {
  const limiter = rateLimiters[type]
  if (limiter) {
    await limiter.delete(key)
    logger.info(`✅ Reset rate limit for ${type}:${key}`)
  }
}

/**
 * 获取剩余限制点数
 */
async function getRateLimitStatus(type, key) {
  const limiter = rateLimiters[type]
  if (!limiter) {
    return null
  }
  
  try {
    const res = await limiter.get(key)
    if (!res) {
      return {
        points: limiter.points,
        remainingPoints: limiter.points,
        msBeforeNext: 0
      }
    }
    
    return {
      points: limiter.points,
      remainingPoints: Math.max(0, limiter.points - res.consumedPoints),
      msBeforeNext: res.msBeforeNext || 0
    }
  } catch (error) {
    logger.error('Failed to get rate limit status:', error)
    return null
  }
}

module.exports = {
  createRateLimitMiddleware,
  resetRateLimit,
  getRateLimitStatus,
  rateLimiters
}
