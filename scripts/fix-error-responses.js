/**
 * 修复错误响应的脚本
 * 将所有不一致的错误响应更新为标准格式
 */

const fs = require('fs')
const path = require('path')

// 需要更新的文件列表
const filesToUpdate = [
  'src/routes/api.js',
  'src/routes/admin.js',
  'src/routes/webhook.js',
  'src/routes/web.js',
  'src/routes/userRoutes.js'
]

// 错误响应模式映射
const errorPatterns = [
  {
    // 500错误应该使用 StandardResponses.internalError
    pattern: /res\.status\(500\)\.json\(\{[\s\S]*?\}\)/g,
    replacement: 'StandardResponses.internalError(res, error)',
    needsImport: true
  },
  {
    // 400错误应该使用 StandardResponses.validationError
    pattern: /res\.status\(400\)\.json\(\{\s*error:\s*['"]([^'"]+)['"]\s*\}\)/g,
    replacement: 'StandardResponses.validationError(res, null, "$1")',
    needsImport: true
  },
  {
    // 401错误应该使用 StandardResponses.unauthorized
    pattern: /res\.status\(401\)\.json\(\{\s*error:\s*['"]([^'"]+)['"]\s*\}\)/g,
    replacement: 'StandardResponses.unauthorized(res, "$1")',
    needsImport: true
  },
  {
    // 403错误应该使用 StandardResponses.forbidden
    pattern: /res\.status\(403\)\.json\(\{\s*error:\s*['"]([^'"]+)['"]\s*\}\)/g,
    replacement: 'StandardResponses.forbidden(res, "$1")',
    needsImport: true
  },
  {
    // 404错误应该使用 StandardResponses.notFound
    pattern: /res\.status\(404\)\.json\(\{\s*error:\s*['"]([^'"]+)['"]\s*\}\)/g,
    replacement: 'StandardResponses.notFound(res)',
    needsImport: true
  },
  {
    // 429错误应该使用 StandardResponses.rateLimited
    pattern: /res\.status\(429\)\.json\(\{[\s\S]*?\}\)/g,
    replacement: 'StandardResponses.rateLimited(res)',
    needsImport: true
  }
]

// 添加导入语句
function addImportStatement(content) {
  const importStatement = "const { StandardResponses } = require('../utils/standardResponses')\n"

  // 检查是否已经有导入
  if (content.includes('standardResponses')) {
    return content
  }

  // 在其他require语句后添加
  const requirePattern = /(const .+ = require\(.+\)\n)+/
  const match = content.match(requirePattern)

  if (match) {
    const lastRequireIndex = match.index + match[0].length
    return content.slice(0, lastRequireIndex) + importStatement + content.slice(lastRequireIndex)
  }

  // 如果没有找到require，添加到文件开头
  return importStatement + content
}

// 处理单个文件
function processFile(filePath) {
  console.log(`Processing: ${filePath}`)

  const fullPath = path.join(process.cwd(), filePath)

  if (!fs.existsSync(fullPath)) {
    console.log(`  ⚠️  File not found: ${filePath}`)
    return
  }

  let content = fs.readFileSync(fullPath, 'utf8')
  let modified = false
  let needsImport = false

  // 应用所有模式
  errorPatterns.forEach(({ pattern, replacement, needsImport: needsImp }) => {
    const matches = content.match(pattern)
    if (matches) {
      console.log(
        `  Found ${matches.length} matches for pattern: ${pattern.source.substring(0, 50)}...`
      )
      content = content.replace(pattern, replacement)
      modified = true
      if (needsImp) {
        needsImport = true
      }
    }
  })

  // 如果有修改且需要导入
  if (modified && needsImport) {
    content = addImportStatement(content)
  }

  // 保存文件
  if (modified) {
    // 创建备份
    const backupPath = `${fullPath}.backup`
    fs.writeFileSync(backupPath, fs.readFileSync(fullPath))
    console.log(`  ✅ Created backup: ${backupPath}`)

    // 写入修改后的内容
    fs.writeFileSync(fullPath, content)
    console.log(`  ✅ Updated: ${filePath}`)
  } else {
    console.log(`  ℹ️  No changes needed`)
  }
}

// 主函数
function main() {
  console.log('🔧 Starting error response standardization...\n')

  filesToUpdate.forEach(processFile)

  console.log('\n✨ Error response standardization complete!')
  console.log('\n📝 Next steps:')
  console.log('1. Review the changes in each file')
  console.log('2. Test the updated error responses')
  console.log('3. Remove backup files after verification')
  console.log('\n💡 Tip: Use "git diff" to review all changes')
}

// 运行脚本
if (require.main === module) {
  main()
}
