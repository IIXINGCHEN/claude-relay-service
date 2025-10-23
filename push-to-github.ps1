#!/usr/bin/env pwsh
# 🚀 自动推送到GitHub脚本

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "     推送到 GitHub 仓库" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 切换到项目目录
$ProjectDir = "G:\wwwroot\CRS\00\03"
Set-Location $ProjectDir

# 检查Git状态
Write-Host "📊 检查Git状态..." -ForegroundColor Yellow
$gitStatus = git status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ 错误: 不是有效的Git仓库" -ForegroundColor Red
    exit 1
}

# 显示当前状态
Write-Host ""
Write-Host "当前分支: " -NoNewline -ForegroundColor Cyan
git branch --show-current
Write-Host "最后提交: " -NoNewline -ForegroundColor Cyan
git log --oneline -1
Write-Host ""

# 检查代理设置
Write-Host "🔍 检查代理配置..." -ForegroundColor Yellow
$httpProxy = git config --global --get http.proxy
$httpsProxy = git config --global --get https.proxy

if ($httpProxy -or $httpsProxy) {
    Write-Host "⚠️  发现代理配置:" -ForegroundColor Yellow
    if ($httpProxy) { Write-Host "   HTTP:  $httpProxy" -ForegroundColor Gray }
    if ($httpsProxy) { Write-Host "   HTTPS: $httpsProxy" -ForegroundColor Gray }
    
    # 测试代理连接
    if ($httpProxy -match "127\.0\.0\.1:(\d+)") {
        $proxyPort = $Matches[1]
        Write-Host "   测试代理连接..." -ForegroundColor Gray
        $proxyTest = Test-NetConnection -ComputerName 127.0.0.1 -Port $proxyPort -InformationLevel Quiet -WarningAction SilentlyContinue
        
        if (-not $proxyTest) {
            Write-Host "   ❌ 代理服务器未运行" -ForegroundColor Red
            Write-Host ""
            Write-Host "请选择:" -ForegroundColor Yellow
            Write-Host "  [1] 清除代理并直连" -ForegroundColor Green
            Write-Host "  [2] 启动代理后继续" -ForegroundColor Green
            Write-Host "  [3] 使用SSH推送" -ForegroundColor Green
            Write-Host "  [0] 退出" -ForegroundColor Gray
            Write-Host ""
            $choice = Read-Host "输入选项"
            
            switch ($choice) {
                "1" {
                    Write-Host "清除代理配置..." -ForegroundColor Cyan
                    git config --global --unset http.proxy 2>$null
                    git config --global --unset https.proxy 2>$null
                    Write-Host "✓ 代理已清除" -ForegroundColor Green
                }
                "2" {
                    Write-Host "请启动代理服务器后按回车继续..." -ForegroundColor Yellow
                    Read-Host
                }
                "3" {
                    Write-Host "切换到SSH..." -ForegroundColor Cyan
                    git remote set-url origin git@github.com:IIXINGCHEN/claude-relay-service.git
                    git config --global --unset http.proxy 2>$null
                    git config --global --unset https.proxy 2>$null
                    Write-Host "✓ 已切换到SSH" -ForegroundColor Green
                }
                default {
                    Write-Host "已取消" -ForegroundColor Gray
                    exit 0
                }
            }
        } else {
            Write-Host "   ✓ 代理连接正常" -ForegroundColor Green
        }
    }
} else {
    Write-Host "✓ 未配置代理" -ForegroundColor Green
}

Write-Host ""

# 显示远程仓库
Write-Host "🔗 远程仓库:" -ForegroundColor Yellow
git remote -v | Select-Object -First 2

Write-Host ""
Write-Host "================================================" -ForegroundColor Yellow
Write-Host "  ⚠️  警告: 即将强制推送" -ForegroundColor Red
Write-Host "================================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "这将:" -ForegroundColor Yellow
Write-Host "  • 清空远程仓库的所有历史记录" -ForegroundColor Gray
Write-Host "  • 用当前本地commit替换远程内容" -ForegroundColor Gray
Write-Host "  • 推送269个文件到main分支" -ForegroundColor Gray
Write-Host ""
Write-Host "目标仓库: https://github.com/IIXINGCHEN/claude-relay-service.git" -ForegroundColor Cyan
Write-Host ""

$confirm = Read-Host "确认推送? (输入 YES 确认)"

if ($confirm -ne "YES") {
    Write-Host ""
    Write-Host "已取消推送" -ForegroundColor Gray
    exit 0
}

Write-Host ""
Write-Host "🚀 开始推送到GitHub..." -ForegroundColor Cyan
Write-Host ""

# 确保在main分支
git branch -M main

# 强制推送
git push -f origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  ✅ 推送成功!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "查看仓库: https://github.com/IIXINGCHEN/claude-relay-service" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "下一步:" -ForegroundColor Yellow
    Write-Host "  1. 在浏览器中验证仓库内容" -ForegroundColor Gray
    Write-Host "  2. 检查commit历史是否正确" -ForegroundColor Gray
    Write-Host "  3. 配置仓库设置（描述、Topics等）" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Red
    Write-Host "  ❌ 推送失败" -ForegroundColor Red
    Write-Host "================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "请尝试:" -ForegroundColor Yellow
    Write-Host "  1. 检查网络连接" -ForegroundColor Gray
    Write-Host "  2. 验证GitHub凭据: gh auth login" -ForegroundColor Gray
    Write-Host "  3. 使用GitHub Desktop手动推送" -ForegroundColor Gray
    Write-Host "  4. 查看详细指南: PUSH_TO_GITHUB.md" -ForegroundColor Gray
    Write-Host ""
    Write-Host "错误代码: $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}
