/**
 * 生产环境安全检查工具
 * 用于在启动时验证关键安全配置
 */

const logger = require('./logger')
const config = require('../../config/config')

class SecurityChecker {
  constructor() {
    this.errors = []
    this.warnings = []
  }

  /**
   * 检查是否使用了默认密钥
   */
  checkDefaultSecrets() {
    const { jwtSecret, encryptionKey } = config.security

    // 检查 JWT Secret
    if (
      !jwtSecret ||
      jwtSecret.includes('CHANGE') ||
      jwtSecret.includes('your-') ||
      jwtSecret.includes('default') ||
      jwtSecret.length < 32
    ) {
      this.errors.push({
        type: 'JWT_SECRET',
        message: 'JWT_SECRET 使用默认值或长度不足！生产环境必须设置强随机密钥（至少32字符）',
        severity: 'CRITICAL'
      })
    }

    // 检查加密密钥（支持32或64字符）
    if (
      !encryptionKey ||
      encryptionKey.includes('CHANGE') ||
      encryptionKey.includes('your-') ||
      encryptionKey.includes('default') ||
      (encryptionKey.length !== 32 && encryptionKey.length !== 64)
    ) {
      this.errors.push({
        type: 'ENCRYPTION_KEY',
        message: 'ENCRYPTION_KEY 使用默认值或长度错误！必须是32或64字符的强随机密钥',
        severity: 'CRITICAL'
      })
    }
  }

  /**
   * 检查 Redis 配置安全性
   */
  checkRedisConfig() {
    const { password, enableTLS } = config.redis

    // 生产环境建议使用 Redis 密码
    if (process.env.NODE_ENV === 'production' && !password) {
      this.warnings.push({
        type: 'REDIS_PASSWORD',
        message: '生产环境建议设置 REDIS_PASSWORD 以增强安全性',
        severity: 'HIGH'
      })
    }

    // 生产环境建议启用 TLS（除非明确表示不需要）
    // 可以通过设置 REDIS_TLS_NOT_REQUIRED=true 来消除此警告
    if (
      process.env.NODE_ENV === 'production' &&
      !enableTLS &&
      process.env.REDIS_TLS_NOT_REQUIRED !== 'true'
    ) {
      this.warnings.push({
        type: 'REDIS_TLS',
        message:
          '生产环境建议启用 REDIS_ENABLE_TLS 进行加密传输（设置 REDIS_TLS_NOT_REQUIRED=true 可消除此警告）',
        severity: 'MEDIUM'
      })
    }
  }

  /**
   * 检查会话密钥
   */
  checkSessionSecret() {
    const { sessionSecret } = config.web

    if (
      !sessionSecret ||
      sessionSecret.includes('CHANGE') ||
      sessionSecret.includes('default') ||
      sessionSecret.length < 32
    ) {
      this.warnings.push({
        type: 'SESSION_SECRET',
        message: 'WEB_SESSION_SECRET 使用默认值，建议设置强随机密钥',
        severity: 'HIGH'
      })
    }
  }

  /**
   * 检查环境变量
   */
  checkEnvironment() {
    // 检查 NODE_ENV
    if (!process.env.NODE_ENV) {
      this.warnings.push({
        type: 'NODE_ENV',
        message: '未设置 NODE_ENV 环境变量，建议设置为 production',
        severity: 'LOW'
      })
    }

    // 生产环境检查
    if (process.env.NODE_ENV === 'production') {
      // 检查是否启用了 DEBUG 模式
      if (process.env.DEBUG_HTTP_TRAFFIC === 'true') {
        this.warnings.push({
          type: 'DEBUG_MODE',
          message: '生产环境不应启用 DEBUG_HTTP_TRAFFIC，会记录敏感信息',
          severity: 'HIGH'
        })
      }
    }
  }

  /**
   * 执行所有检查
   */
  runAllChecks() {
    logger.info('🔒 开始安全配置检查...')

    this.checkDefaultSecrets()
    this.checkRedisConfig()
    this.checkSessionSecret()
    this.checkEnvironment()

    return {
      passed: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    }
  }

  /**
   * 打印检查结果
   */
  printResults() {
    const result = this.runAllChecks()

    // 打印错误
    if (result.errors.length > 0) {
      logger.error('❌ 发现 CRITICAL 安全问题:')
      result.errors.forEach((error, index) => {
        logger.error(`  ${index + 1}. [${error.type}] ${error.message}`)
      })
      logger.error('')
      logger.error('💡 解决方案:')
      logger.error('  1. 生成安全密钥:')
      logger.error(
        "     node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
      )
      logger.error('  2. 更新 .env 文件中的密钥配置')
      logger.error('  3. 重启服务')
      logger.error('')
    }

    // 打印警告
    if (result.warnings.length > 0) {
      logger.warn('⚠️  发现安全建议:')
      result.warnings.forEach((warning, index) => {
        logger.warn(`  ${index + 1}. [${warning.type}] ${warning.message}`)
      })
      logger.warn('')
    }

    if (result.errors.length === 0 && result.warnings.length === 0) {
      logger.success('✅ 安全配置检查通过!')
    }

    return result
  }

  /**
   * 在生产环境强制检查
   * 如果有严重错误，则拒绝启动
   */
  enforceProductionSecurity() {
    const result = this.printResults()

    // 生产环境下，如果有严重错误，拒绝启动
    if (process.env.NODE_ENV === 'production' && result.errors.length > 0) {
      logger.error('🚨 生产环境安全检查失败，服务拒绝启动!')
      logger.error('   请修复上述 CRITICAL 问题后重试')
      process.exit(1)
    }

    // 开发环境只警告
    if (process.env.NODE_ENV !== 'production' && result.errors.length > 0) {
      logger.warn('⚠️  开发环境检测到安全问题，生产部署前请务必修复')
    }

    return result
  }
}

module.exports = new SecurityChecker()
