#!/usr/bin/env node

/**
 * 环境变量验证脚本
 * 用于部署前验证必需的环境变量是否正确配置
 */

require('dotenv').config()
const crypto = require('crypto')

class EnvValidator {
  constructor() {
    this.errors = []
    this.warnings = []
    this.info = []
  }

  /**
   * 验证必需的环境变量
   */
  validateRequired() {
    const required = [
      { key: 'JWT_SECRET', minLength: 32 },
      { key: 'ENCRYPTION_KEY', exactLength: 32 },
      { key: 'REDIS_HOST', minLength: 1 },
      { key: 'REDIS_PORT', minLength: 1 }
    ]

    required.forEach(({ key, minLength, exactLength }) => {
      const value = process.env[key]

      if (!value) {
        this.errors.push(`❌ ${key}: 未设置`)
        return
      }

      if (exactLength && value.length !== exactLength) {
        this.errors.push(`❌ ${key}: 长度必须为 ${exactLength} 字符（当前: ${value.length}）`)
      } else if (minLength && value.length < minLength) {
        this.errors.push(`❌ ${key}: 长度至少需要 ${minLength} 字符（当前: ${value.length}）`)
      }

      // 检查是否使用默认值
      if (value.includes('CHANGE') || value.includes('your-') || value.includes('default')) {
        this.errors.push(`❌ ${key}: 正在使用默认值，生产环境必须修改`)
      }
    })
  }

  /**
   * 验证推荐的环境变量
   */
  validateRecommended() {
    const recommended = [
      { key: 'NODE_ENV', expectedValue: 'production' },
      { key: 'REDIS_PASSWORD', message: '生产环境建议设置' },
      { key: 'REDIS_ENABLE_TLS', message: '生产环境建议启用' }
    ]

    recommended.forEach(({ key, expectedValue, message }) => {
      const value = process.env[key]

      if (!value) {
        this.warnings.push(`⚠️  ${key}: ${message || '未设置'}`)
      } else if (expectedValue && value !== expectedValue) {
        this.warnings.push(`⚠️  ${key}: 当前值 "${value}"，建议设置为 "${expectedValue}"`)
      }
    })
  }

  /**
   * 验证安全性配置
   */
  validateSecurity() {
    // 检查 DEBUG 模式
    if (process.env.DEBUG_HTTP_TRAFFIC === 'true') {
      if (process.env.NODE_ENV === 'production') {
        this.errors.push(`❌ DEBUG_HTTP_TRAFFIC: 生产环境不应启用 DEBUG 模式`)
      } else {
        this.warnings.push(`⚠️  DEBUG_HTTP_TRAFFIC: 已启用，注意不要在生产环境使用`)
      }
    }

    // 检查 LOG_LEVEL
    if (process.env.LOG_LEVEL === 'debug') {
      this.warnings.push(`⚠️  LOG_LEVEL: debug 级别会产生大量日志，生产环境建议使用 info 或 warn`)
    }
  }

  /**
   * 生成安全密钥
   */
  generateSecrets() {
    console.log('\n🔐 生成推荐的安全密钥:\n')
    console.log('# 将以下内容添加到 .env 文件\n')
    console.log(`JWT_SECRET=${crypto.randomBytes(32).toString('base64')}`)
    console.log(`ENCRYPTION_KEY=${crypto.randomBytes(16).toString('hex')}`)
    console.log(`WEB_SESSION_SECRET=${crypto.randomBytes(32).toString('base64')}`)
    console.log('')
  }

  /**
   * 打印验证结果
   */
  printResults() {
    console.log('\n🔍 环境变量验证结果\n')
    console.log('='.repeat(60))

    // 打印错误
    if (this.errors.length > 0) {
      console.log('\n❌ 严重错误 (必须修复):')
      this.errors.forEach((error) => console.log(`   ${error}`))
    }

    // 打印警告
    if (this.warnings.length > 0) {
      console.log('\n⚠️  警告 (建议修复):')
      this.warnings.forEach((warning) => console.log(`   ${warning}`))
    }

    // 打印信息
    if (this.info.length > 0) {
      console.log('\nℹ️  信息:')
      this.info.forEach((info) => console.log(`   ${info}`))
    }

    console.log(`\n${'='.repeat(60)}`)

    // 总结
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('\n✅ 所有环境变量验证通过!\n')
      return true
    } else if (this.errors.length > 0) {
      console.log(`\n🚨 发现 ${this.errors.length} 个错误，${this.warnings.length} 个警告`)
      console.log('   生产部署前请务必修复所有错误!\n')
      return false
    } else {
      console.log(`\n✅ 必需配置已通过，但有 ${this.warnings.length} 个建议优化项\n`)
      return true
    }
  }

  /**
   * 运行所有验证
   */
  validate() {
    this.validateRequired()
    this.validateRecommended()
    this.validateSecurity()

    const passed = this.printResults()

    if (!passed) {
      console.log('💡 提示: 运行以下命令生成安全密钥:')
      console.log('   npm run generate:secrets\n')
      process.exit(1)
    }

    return passed
  }
}

// 主函数
function main() {
  const validator = new EnvValidator()

  // 检查是否需要生成密钥
  if (process.argv.includes('--generate-secrets')) {
    validator.generateSecrets()
    return
  }

  // 运行验证
  validator.validate()
}

// 如果直接运行此脚本
if (require.main === module) {
  main()
}

module.exports = EnvValidator
