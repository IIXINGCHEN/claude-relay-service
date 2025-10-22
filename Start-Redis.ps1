# Redis 快速启动脚本
# PowerShell 版本

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Redis 快速启动脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 检查常见的 Redis 安装位置
$redisPaths = @(
    "C:\Redis",
    "C:\Program Files\Redis",
    "$env:LOCALAPPDATA\Redis",
    "$env:USERPROFILE\Redis",
    "D:\Redis"
)

$redisFound = $false

foreach ($path in $redisPaths) {
    $redisExe = Join-Path $path "redis-server.exe"
    if (Test-Path $redisExe) {
        Write-Host "[发现] Redis 安装在: $path" -ForegroundColor Green
        Write-Host "[启动] 正在启动 Redis 服务器..." -ForegroundColor Yellow
        
        # 启动 Redis
        Start-Process -FilePath $redisExe -WorkingDirectory $path -WindowStyle Normal
        
        Write-Host "[完成] Redis 已在新窗口中启动" -ForegroundColor Green
        Write-Host ""
        Write-Host "提示: 保持 Redis 窗口运行，然后启动 Claude Relay Service" -ForegroundColor Cyan
        Write-Host "      cd G:\wwwroot\CRS\00\claude-relay-service" -ForegroundColor Gray
        Write-Host "      npm start" -ForegroundColor Gray
        Write-Host ""
        
        $redisFound = $true
        break
    }
}

if (-not $redisFound) {
    # 尝试通过 WSL 启动
    Write-Host "[未找到] Windows 版 Redis 未安装" -ForegroundColor Yellow
    Write-Host "[尝试] 检查 WSL 中的 Redis..." -ForegroundColor Yellow
    
    try {
        $wslResult = wsl -e redis-server --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[发现] WSL 中已安装 Redis" -ForegroundColor Green
            Write-Host "[启动] 正在通过 WSL 启动 Redis..." -ForegroundColor Yellow
            
            wsl -e sudo service redis-server start
            
            Write-Host "[完成] Redis 已通过 WSL 启动" -ForegroundColor Green
            Write-Host ""
            Write-Host "提示: 现在可以启动 Claude Relay Service" -ForegroundColor Cyan
            Write-Host "      cd G:\wwwroot\CRS\00\claude-relay-service" -ForegroundColor Gray
            Write-Host "      npm start" -ForegroundColor Gray
            Write-Host ""
            
            $redisFound = $true
        }
    }
    catch {
        # WSL 不可用
    }
}

if (-not $redisFound) {
    # 所有方法都失败
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  Redis 未安装！" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "请选择以下方法之一安装 Redis:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "方法 1: Windows 版 Redis (推荐)" -ForegroundColor Cyan
    Write-Host "  下载: https://github.com/tporadowski/redis/releases" -ForegroundColor Gray
    Write-Host "  解压到: C:\Redis" -ForegroundColor Gray
    Write-Host "  然后重新运行此脚本" -ForegroundColor Gray
    Write-Host ""
    Write-Host "方法 2: 通过 WSL 安装" -ForegroundColor Cyan
    Write-Host "  wsl -d Ubuntu" -ForegroundColor Gray
    Write-Host "  sudo apt update" -ForegroundColor Gray
    Write-Host "  sudo apt install redis-server -y" -ForegroundColor Gray
    Write-Host "  sudo service redis-server start" -ForegroundColor Gray
    Write-Host "  exit" -ForegroundColor Gray
    Write-Host "  然后重新运行此脚本" -ForegroundColor Gray
    Write-Host ""
    Write-Host "方法 3: 使用 Docker" -ForegroundColor Cyan
    Write-Host "  docker run -d --name redis -p 6379:6379 redis:alpine" -ForegroundColor Gray
    Write-Host ""
    Write-Host "详细说明请查看: docs\STARTUP_GUIDE.md" -ForegroundColor Yellow
    Write-Host ""
    
    exit 1
}

Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
