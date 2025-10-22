#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

// 需要清理的文件列表
const filesToClean = [
  'src/services/claudeConsoleRelayService.js',
  'src/services/claudeConsoleAccountService.js',
  'src/services/ccrRelayService.js',
  'src/services/ccrAccountService.js',
  'src/routes/api.js',
  'src/models/redis.js',
  'src/services/claudeRelayService.js'
]

// DEBUG日志模式（暂未使用，保留备用）
const _debugPatterns = [
  /logger\.debug\(\s*\[DEBUG\][^)]+\)/g,
  /logger\.debug\(\s*`\[DEBUG\][^`]+`[^)]*\)/g,
  /logger\.debug\([^)]*\[DEBUG\][^)]*\)/g,
  /console\.error\([^)]*: ❌[^)]*\)/g
]

// Redis console.error 替换为 logger
const redisPatterns = [
  {
    pattern: /console\.error\('Error getting today stats:'([^)]+)\)/g,
    replacement: "logger.error('Error getting today stats:'$1)"
  },
  {
    pattern: /console\.error\('Error getting system averages:'([^)]+)\)/g,
    replacement: "logger.error('Error getting system averages:'$1)"
  },
  {
    pattern: /console\.error\('Error getting realtime system metrics:'([^)]+)\)/g,
    replacement: "logger.error('Error getting realtime system metrics:'$1)"
  }
]

function cleanFile(filePath) {
  const fullPath = path.join(process.cwd(), filePath)

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  文件不存在: ${filePath}`)
    return false
  }

  let content = fs.readFileSync(fullPath, 'utf-8')
  let modified = false
  let removedCount = 0

  // 逐行处理，删除DEBUG日志行
  const lines = content.split('\n')
  const cleanedLines = []
  let skipNext = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 检查是否是DEBUG日志行
    const isDebugLine =
      line.includes('logger.debug') &&
      (line.includes('[DEBUG]') || line.includes('🎯') || line.includes('📤'))

    // 检查是否是 console.error(': ❌ ', ...)
    const isConsoleErrorLine = line.includes("console.error(': ❌ ',")

    if (isDebugLine || isConsoleErrorLine) {
      removedCount++
      modified = true
      // 如果下一行是空行，也跳过
      if (i + 1 < lines.length && lines[i + 1].trim() === '') {
        skipNext = true
      }
      continue
    }

    if (skipNext) {
      skipNext = false
      if (line.trim() === '') {
        continue
      }
    }

    cleanedLines.push(line)
  }

  if (modified) {
    content = cleanedLines.join('\n')
  }

  // 应用Redis特定的替换
  if (filePath.includes('redis.js')) {
    redisPatterns.forEach(({ pattern, replacement }) => {
      if (pattern.test(content)) {
        content = content.replace(pattern, replacement)
        modified = true
      }
    })
  }

  // 移除连续的多个空行（超过2个）
  content = content.replace(/\n\n\n+/g, '\n\n')

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf-8')
    console.log(`✅ 已清理: ${filePath} (移除 ${removedCount} 行DEBUG日志)`)
    return true
  } else {
    console.log(`⚪ 无需修改: ${filePath}`)
    return false
  }
}

function main() {
  console.log('🧹 开始清理DEBUG日志和console语句...\n')

  let totalCleaned = 0

  filesToClean.forEach((file) => {
    if (cleanFile(file)) {
      totalCleaned++
    }
  })

  console.log(`\n✨ 完成! 共清理 ${totalCleaned} 个文件`)
}

main()
