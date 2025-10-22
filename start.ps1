# Claude Relay Service - 一键启动脚本 (PowerShell)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🚀 Claude Relay Service - 一键启动脚本 (PowerShell)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# 检查 Node.js 是否安装
try {
    $nodeVersion = node --version
    Write-Host "✅ 找到 Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ 错误: 未找到 Node.js，请先安装 Node.js 18 或更高版本" -ForegroundColor Red
    Write-Host "下载地址: https://nodejs.org/" -ForegroundColor Yellow
    Read-Host "按任意键退出"
    exit 1
}

# 运行 Node.js 脚本
try {
    & node start.js
} catch {
    Write-Host ""
    Write-Host "❌ 启动失败，请检查错误信息" -ForegroundColor Red
    Read-Host "按任意键退出"
    exit 1
}