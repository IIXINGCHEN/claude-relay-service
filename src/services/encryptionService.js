/**
 * 统一加密服务
 * 提供所有敏感数据的加密和解密功能
 * 使用 AES-256-GCM 算法提供更强的安全性
 */

const crypto = require('crypto')
const config = require('../../config/config')
const logger = require('../utils/logger')
const LRUCache = require('../utils/lruCache')

class EncryptionService {
  constructor() {
    // 使用 AES-256-GCM 提供认证加密
    this.ALGORITHM = 'aes-256-gcm'
    this.IV_LENGTH = 16
    this.TAG_LENGTH = 16
    this.SALT_LENGTH = 32

    // 密钥派生参数
    this.KEY_ITERATIONS = 100000 // PBKDF2 迭代次数
    this.KEY_LENGTH = 32

    // 性能优化：缓存派生的加密密钥
    this._keyCache = new Map()
    this._keyCacheTTL = 3600000 // 1小时过期

    // 解密结果缓存（提高性能）
    this._decryptCache = new LRUCache(1000, 5 * 60 * 1000) // 1000项，5分钟TTL

    // 验证配置的加密密钥
    this._validateEncryptionKey()

    // 定期清理缓存
    this._setupCacheCleanup()

    logger.info('🔐 Unified encryption service initialized with AES-256-GCM')
  }

  /**
   * 验证加密密钥配置
   */
  _validateEncryptionKey() {
    const { encryptionKey } = config.security

    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY is not configured')
    }

    if (encryptionKey.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters')
    }

    // 检查是否使用了默认值
    if (
      encryptionKey.includes('CHANGE') ||
      encryptionKey.includes('your-') ||
      encryptionKey.includes('default')
    ) {
      logger.error('🚨 CRITICAL: Using default encryption key! This is a security risk!')
      if (process.env.NODE_ENV === 'production') {
        throw new Error('Cannot use default encryption key in production')
      }
    }
  }

  /**
   * 设置缓存清理定时器
   */
  _setupCacheCleanup() {
    // 每10分钟清理一次缓存
    const cleanupInterval = setInterval(
      () => {
        // 清理过期的密钥缓存
        const now = Date.now()
        for (const [key, value] of this._keyCache.entries()) {
          if (now > value.expiresAt) {
            this._keyCache.delete(key)
          }
        }

        // 清理解密缓存
        this._decryptCache.cleanup()

        const stats = this._decryptCache.getStats()
        logger.debug(
          `🧹 Encryption cache cleanup completed. Decrypt cache stats: ${JSON.stringify(stats)}`
        )
      },
      10 * 60 * 1000
    )

    // 不阻止进程退出
    if (cleanupInterval.unref) {
      cleanupInterval.unref()
    }
  }

  /**
   * 派生加密密钥（带缓存）
   * @param {string} context - 加密上下文（用于生成不同的密钥）
   * @returns {Buffer} 派生的密钥
   */
  _deriveKey(context = 'default') {
    const cacheKey = `key:${context}`
    const cached = this._keyCache.get(cacheKey)

    if (cached && Date.now() < cached.expiresAt) {
      return cached.key
    }

    // 使用 PBKDF2 派生密钥
    const salt = Buffer.from(`${config.security.encryptionKey}:${context}`, 'utf8')
    const key = crypto.pbkdf2Sync(
      config.security.encryptionKey,
      salt,
      this.KEY_ITERATIONS,
      this.KEY_LENGTH,
      'sha256'
    )

    // 缓存派生的密钥
    this._keyCache.set(cacheKey, {
      key,
      expiresAt: Date.now() + this._keyCacheTTL
    })

    return key
  }

  /**
   * 加密数据
   * @param {string} text - 要加密的文本
   * @param {string} context - 加密上下文（可选）
   * @returns {string} 加密后的数据（格式：iv:tag:encrypted）
   */
  encrypt(text, context = 'default') {
    if (!text) {
      return ''
    }

    try {
      const key = this._deriveKey(context)
      const iv = crypto.randomBytes(this.IV_LENGTH)
      const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv)

      let encrypted = cipher.update(text, 'utf8')
      encrypted = Buffer.concat([encrypted, cipher.final()])

      // 获取认证标签
      const tag = cipher.getAuthTag()

      // 返回格式：iv:tag:encrypted（所有部分都是hex编码）
      return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
    } catch (error) {
      logger.error('Encryption failed:', error)
      throw new Error('Failed to encrypt data')
    }
  }

  /**
   * 解密数据
   * @param {string} encryptedData - 加密的数据
   * @param {string} context - 加密上下文（可选）
   * @returns {string} 解密后的文本
   */
  decrypt(encryptedData, context = 'default') {
    if (!encryptedData) {
      return ''
    }

    // 检查缓存
    const cacheKey = crypto.createHash('sha256').update(`${encryptedData}:${context}`).digest('hex')

    const cached = this._decryptCache.get(cacheKey)
    if (cached !== undefined) {
      return cached
    }

    try {
      // 解析加密数据格式
      const parts = encryptedData.split(':')

      // 处理旧格式（向后兼容）
      if (parts.length === 2) {
        return this._decryptLegacy(encryptedData, context)
      }

      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format')
      }

      const [ivHex, tagHex, encryptedHex] = parts
      const key = this._deriveKey(context)
      const iv = Buffer.from(ivHex, 'hex')
      const tag = Buffer.from(tagHex, 'hex')
      const encrypted = Buffer.from(encryptedHex, 'hex')

      const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv)
      decipher.setAuthTag(tag)

      let decrypted = decipher.update(encrypted)
      decrypted = Buffer.concat([decrypted, decipher.final()])

      const result = decrypted.toString('utf8')

      // 缓存结果
      this._decryptCache.set(cacheKey, result)

      return result
    } catch (error) {
      logger.error('Decryption failed:', error)
      // 尝试使用旧算法解密
      try {
        return this._decryptLegacy(encryptedData, context)
      } catch (legacyError) {
        throw new Error('Failed to decrypt data')
      }
    }
  }

  /**
   * 解密旧格式数据（向后兼容）
   * @private
   */
  _decryptLegacy(encryptedData, _context) {
    try {
      // 尝试旧的 AES-256-CBC 格式
      const parts = encryptedData.split(':')
      if (parts.length === 2) {
        const [ivHex, encryptedHex] = parts
        const key = crypto.scryptSync(config.security.encryptionKey, 'claude-relay-salt', 32)
        const iv = Buffer.from(ivHex, 'hex')
        const encrypted = Buffer.from(encryptedHex, 'hex')

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
        let decrypted = decipher.update(encrypted)
        decrypted = Buffer.concat([decrypted, decipher.final()])

        return decrypted.toString('utf8')
      }
    } catch (error) {
      logger.debug('Legacy decryption failed, data might be corrupted')
    }

    throw new Error('Unable to decrypt legacy data')
  }

  /**
   * 批量加密
   * @param {Object} data - 要加密的对象
   * @param {Array<string>} fields - 要加密的字段列表
   * @param {string} context - 加密上下文
   * @returns {Object} 包含加密字段的新对象
   */
  encryptFields(data, fields, context = 'default') {
    const result = { ...data }

    for (const field of fields) {
      if (data[field]) {
        result[field] = this.encrypt(data[field], context)
      }
    }

    return result
  }

  /**
   * 批量解密
   * @param {Object} data - 包含加密字段的对象
   * @param {Array<string>} fields - 要解密的字段列表
   * @param {string} context - 加密上下文
   * @returns {Object} 包含解密字段的新对象
   */
  decryptFields(data, fields, context = 'default') {
    const result = { ...data }

    for (const field of fields) {
      if (data[field]) {
        try {
          result[field] = this.decrypt(data[field], context)
        } catch (error) {
          logger.warn(`Failed to decrypt field ${field}, keeping original value`)
          result[field] = data[field]
        }
      }
    }

    return result
  }

  /**
   * 生成安全的随机令牌
   * @param {number} length - 令牌长度（字节）
   * @returns {string} Hex编码的随机令牌
   */
  generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString('hex')
  }

  /**
   * 哈希密码（使用 PBKDF2）
   * @param {string} password - 原始密码
   * @param {string} salt - 盐值（可选）
   * @returns {{hash: string, salt: string}} 哈希和盐值
   */
  hashPassword(password, salt = null) {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(this.SALT_LENGTH)

    const hash = crypto.pbkdf2Sync(password, saltBuffer, this.KEY_ITERATIONS, 64, 'sha512')

    return {
      hash: hash.toString('hex'),
      salt: saltBuffer.toString('hex')
    }
  }

  /**
   * 验证密码
   * @param {string} password - 原始密码
   * @param {string} hash - 存储的哈希值
   * @param {string} salt - 存储的盐值
   * @returns {boolean} 密码是否正确
   */
  verifyPassword(password, hash, salt) {
    const result = this.hashPassword(password, salt)
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(result.hash, 'hex'))
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    return {
      keyCache: {
        size: this._keyCache.size,
        ttl: this._keyCacheTTL
      },
      decryptCache: this._decryptCache.getStats()
    }
  }

  /**
   * 清理所有缓存
   */
  clearCache() {
    this._keyCache.clear()
    this._decryptCache.clear()
    logger.info('🧹 Encryption service cache cleared')
  }
}

// 导出单例
module.exports = new EncryptionService()
