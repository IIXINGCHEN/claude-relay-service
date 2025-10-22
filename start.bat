@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ============================================================
echo 🚀 Claude Relay Service - 一键启动脚本 (Windows)
echo ============================================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到 Node.js，请先安装 Node.js 18 或更高版本
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

REM 运行 Node.js 脚本
node start.js

REM 如果出错，显示错误信息
if %errorlevel% neq 0 (
    echo.
    echo ❌ 启动失败，请检查错误信息
    pause
    exit /b %errorlevel%
)