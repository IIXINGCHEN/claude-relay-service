#!/bin/bash

# 🚀 Claude Relay Service - 一键部署脚本
# 适用于 Node.js 直接部署的环境

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 加载公共函数库
if [ -f "$SCRIPT_DIR/scripts/common.sh" ]; then
    source "$SCRIPT_DIR/scripts/common.sh"
else
    echo "❌ 错误: 无法找到公共函数库 scripts/common.sh"
    exit 1
fi

# 检查系统要求
check_requirements() {
    log_step 1 "检查系统要求"
    
    detect_os
    detect_package_manager
    
    check_node_version || exit 1

    # 检查 Redis（可选）
    check_redis_connection || log_warning "Redis 未运行或未安装"

    # 检查 PM2（可选）
    if command -v pm2 &> /dev/null; then
        log_success "PM2 可用: $(pm2 -v)"
        PM2_AVAILABLE=true
    else
        log_info "PM2 未安装，将使用直接启动方式"
        PM2_AVAILABLE=false
    fi
}

# 安装依赖
install_dependencies() {
    log_step 2 "安装项目依赖"
    install_npm_dependencies || exit 1
}

# 构建前端
build_frontend() {
    log_info "构建前端管理界面..."
    if [ -d "web/admin-spa" ]; then
        cd web/admin-spa
        if [ -f "package.json" ]; then
            npm install
            npm run build
            cd ../..
            log_success "前端构建完成"
        else
            log_warning "前端 package.json 未找到，跳过前端构建"
            cd ../..
        fi
    else
        log_warning "前端目录未找到，跳过前端构建"
    fi
}

# 配置环境
configure_environment() {
    log_step 3 "配置环境"
    setup_env_file
    
    # 确保端口配置
    if ! grep -q "^PORT=" .env 2>/dev/null; then
        echo "PORT=13006" >> .env
        log_info "已设置默认端口: 13006"
    fi

    # 创建必要目录
    mkdir -p logs data redis_data
    chmod 755 logs data redis_data
    log_success "目录结构创建完成"
}

# 启动服务
start_service() {
    log_step 5 "启动服务"

    if [ "$PM2_AVAILABLE" = true ]; then
        log_info "使用 PM2 启动服务..."
        pm2 start start.js --name claude-relay || pm2 start src/app.js --name claude-relay
        log_success "服务已通过 PM2 启动"
        log_info "管理命令: pm2 status | pm2 logs claude-relay"
    else
        log_info "使用 nohup 启动服务..."
        nohup node src/app.js > logs/app.log 2>&1 &
        echo $! > app.pid
        log_success "服务已在后台启动 (PID: $(cat app.pid))"
        log_info "管理命令: tail -f logs/app.log | kill \$(cat app.pid)"
    fi
}

# 验证部署
verify_deployment() {
    log_step 6 "验证部署"
    
    sleep 5
    health_check 13006 || log_warning "健康检查失败，请稍后再试或检查日志"
    display_service_info 13006
    
    echo "📋 管理命令:"
    if [ "$PM2_AVAILABLE" = true ]; then
        echo "  查看状态: pm2 status"
        echo "  查看日志: pm2 logs claude-relay"
        echo "  重启服务: pm2 restart claude-relay"
        echo "  停止服务: pm2 stop claude-relay"
    else
        echo "  查看日志: tail -f logs/app.log"
        echo "  停止服务: kill \$(cat app.pid)"
    fi
    echo ""
}

# 主函数
main() {
    log_bold "========================================================"
    log_bold "🚀 Claude Relay Service - Node.js 直接部署"
    log_bold "========================================================"
    echo ""

    setup_project_dir || exit 1
    check_requirements
    
    if ! check_npm_dependencies; then
        install_dependencies
    fi
    
    build_frontend
    configure_environment
    start_service
    verify_deployment
}

# 执行主函数
main "$@"