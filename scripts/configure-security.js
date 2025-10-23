#!/usr/bin/env node

/**
 * 安全配置助手
 * 帮助用户快速配置安全选项
 */

const fs = require('fs')
const path = require('path')
const readline = require('readline')
const crypto = require('crypto')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const envPath = path.join(__dirname, '..', '.env')

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
}

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve))
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

async function main() {
  log('\n🔒 Claude Relay Service - 安全配置助手\n', 'bold')

  // 检查 .env 文件
  let envContent = ''
  const envVars = {}

  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8')
    // 解析现有的环境变量
    envContent.split('\n').forEach((line) => {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) {
        envVars[match[1].trim()] = match[2].trim()
      }
    })
    log('✅ 找到现有的 .env 文件', 'green')
  } else {
    log('⚠️  未找到 .env 文件，将创建新文件', 'yellow')
  }

  log('\n当前安全配置状态：', 'cyan')

  // 检查必要的安全配置
  const checks = [
    {
      key: 'JWT_SECRET',
      status: envVars.JWT_SECRET && !envVars.JWT_SECRET.includes('CHANGE'),
      message: 'JWT 密钥'
    },
    {
      key: 'ENCRYPTION_KEY',
      status: envVars.ENCRYPTION_KEY && !envVars.ENCRYPTION_KEY.includes('CHANGE'),
      message: '加密密钥'
    },
    {
      key: 'REDIS_PASSWORD',
      status: !!envVars.REDIS_PASSWORD,
      message: 'Redis 密码'
    },
    {
      key: 'REDIS_ENABLE_TLS',
      status: envVars.REDIS_ENABLE_TLS === 'true',
      message: 'Redis TLS'
    }
  ]

  checks.forEach((check) => {
    const icon = check.status ? '✅' : '❌'
    const color = check.status ? 'green' : 'red'
    log(`  ${icon} ${check.message}: ${check.status ? '已配置' : '未配置'}`, color)
  })

  // Redis TLS 配置
  log('\n📡 Redis TLS 配置', 'bold')
  log('Redis TLS 可以加密 Redis 连接，但在以下情况下可能不需要：', 'yellow')
  log('  1. Redis 运行在 localhost（本地开发）')
  log('  2. Redis 和应用在同一安全内网')
  log('  3. 使用了其他网络安全措施（如 VPN）')

  const needRedisTLS = await question('\n您需要启用 Redis TLS 吗？(y/n/skip): ')

  if (needRedisTLS.toLowerCase() === 'y') {
    // 启用 Redis TLS
    envVars.REDIS_ENABLE_TLS = 'true'

    const tlsRejectUnauth = await question('是否验证 TLS 证书？(y/n) [建议生产环境选择 y]: ')
    if (tlsRejectUnauth.toLowerCase() === 'n') {
      envVars.REDIS_TLS_REJECT_UNAUTHORIZED = 'false'
    }

    log('✅ Redis TLS 已启用', 'green')
  } else if (needRedisTLS.toLowerCase() === 'n') {
    // 明确不需要 TLS
    envVars.REDIS_TLS_NOT_REQUIRED = 'true'
    log('✅ 已标记为不需要 Redis TLS（将不再显示警告）', 'green')
  } else {
    log('⏭️  跳过 Redis TLS 配置', 'yellow')
  }

  // 生成缺失的密钥
  log('\n🔑 密钥生成', 'bold')

  if (!envVars.JWT_SECRET || envVars.JWT_SECRET.includes('CHANGE')) {
    const generateJWT = await question('是否自动生成 JWT_SECRET？(y/n): ')
    if (generateJWT.toLowerCase() === 'y') {
      envVars.JWT_SECRET = crypto.randomBytes(32).toString('base64')
      log('✅ JWT_SECRET 已生成', 'green')
    }
  }

  if (!envVars.ENCRYPTION_KEY || envVars.ENCRYPTION_KEY.includes('CHANGE')) {
    const generateEncryption = await question('是否自动生成 ENCRYPTION_KEY？(y/n): ')
    if (generateEncryption.toLowerCase() === 'y') {
      envVars.ENCRYPTION_KEY = crypto.randomBytes(16).toString('hex')
      log('✅ ENCRYPTION_KEY 已生成', 'green')
    }
  }

  if (!envVars.REDIS_PASSWORD) {
    const generateRedisPass = await question('是否为 Redis 设置密码？(y/n): ')
    if (generateRedisPass.toLowerCase() === 'y') {
      envVars.REDIS_PASSWORD = crypto.randomBytes(16).toString('base64')
      log('✅ REDIS_PASSWORD 已生成', 'green')
    }
  }

  // 保存配置
  const saveConfig = await question('\n是否保存配置到 .env 文件？(y/n): ')

  if (saveConfig.toLowerCase() === 'y') {
    // 更新或添加环境变量
    let newEnvContent = envContent

    for (const [key, value] of Object.entries(envVars)) {
      const regex = new RegExp(`^${key}=.*$`, 'm')
      if (regex.test(newEnvContent)) {
        // 更新现有变量
        newEnvContent = newEnvContent.replace(regex, `${key}=${value}`)
      } else {
        // 添加新变量
        newEnvContent += `\n${key}=${value}`
      }
    }

    // 备份现有文件
    if (fs.existsSync(envPath)) {
      const backupPath = `${envPath}.backup.${Date.now()}`
      fs.copyFileSync(envPath, backupPath)
      log(`\n📋 已备份现有配置到: ${path.basename(backupPath)}`, 'cyan')
    }

    // 保存新配置
    fs.writeFileSync(envPath, `${newEnvContent.trim()}\n`)
    log('✅ 配置已保存到 .env 文件', 'green')

    log('\n📌 重要提示：', 'bold')
    log('1. 请妥善保管生成的密钥，丢失后无法恢复', 'yellow')
    log('2. 不要将 .env 文件提交到版本控制系统', 'yellow')
    log('3. 重启服务以应用新配置: npm restart', 'yellow')

    if (envVars.REDIS_ENABLE_TLS === 'true') {
      log('\n📡 Redis TLS 额外步骤：', 'cyan')
      log('1. 确保 Redis 服务器已配置 TLS 支持')
      log('2. 将 REDIS_PORT 更改为 TLS 端口（通常是 6380）')
      log('3. 如需要，配置证书路径')
      log('详见: docs/SECURITY_CONFIGURATION.md')
    }
  } else {
    log('\n⏭️  未保存配置', 'yellow')
  }

  log('\n✨ 配置助手完成！', 'green')
  rl.close()
}

main().catch((error) => {
  log(`\n❌ 错误: ${error.message}`, 'red')
  rl.close()
  process.exit(1)
})
