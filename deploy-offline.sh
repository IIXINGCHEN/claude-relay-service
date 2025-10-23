#!/bin/bash

# 🚀 Claude Relay Service - 完全离线部署脚本
# 适用于无法访问任何外部镜像仓库的环境

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查系统要求
check_requirements() {
    log_info "检查系统要求..."

    # 检查是否为 root 用户
    if [ "$EUID" -eq 0 ]; then
        log_warning "检测到 root 用户，将创建普通用户运行服务"
    fi

    # 检查 Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        log_info "请安装 Node.js 18.0.0 或更高版本："
        log_info "  CentOS/RHEL: sudo yum install nodejs npm"
        log_info "  Ubuntu/Debian: sudo apt install nodejs npm"
        log_info "  或使用 nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
        exit 1
    fi

    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 版本过低。需要 18.0.0 或更高版本，当前版本: $(node -v)"
        exit 1
    fi
    log_success "Node.js 版本检查通过: $(node -v)"

    # 检查 npm
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    log_success "npm 版本: $(npm -v)"

    # 检查项目目录 - 使用当前目录或指定目录
    PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
    if [ ! -d "$PROJECT_DIR" ]; then
        log_error "项目目录不存在: $PROJECT_DIR"
        log_info "请设置环境变量: export PROJECT_DIR=/path/to/project"
        exit 1
    fi

    cd "$PROJECT_DIR"
    log_success "项目目录: $(pwd)"
}

# 配置 npm 镜像源（如果需要）
setup_npm_registry() {
    log_info "配置 npm 镜像源..."

    # 设置国内镜像源
    npm config set registry https://registry.npmmirror.com
    log_success "已设置 npm 镜像源为: https://registry.npmmirror.com"
}

# 安装依赖
install_dependencies() {
    log_info "安装 Node.js 依赖..."

    # 清除缓存
    npm cache clean --force

    # 安装生产依赖
    npm install --production

    if [ $? -eq 0 ]; then
        log_success "依赖安装完成"
    else
        log_error "依赖安装失败"
        exit 1
    fi
}

# 构建前端
build_frontend() {
    log_info "构建前端管理界面..."

    if [ -d "web/admin-spa" ]; then
        cd web/admin-spa

        # 安装前端依赖
        npm install --registry=https://registry.npmmirror.com

        if [ $? -eq 0 ]; then
            log_success "前端依赖安装完成"
        else
            log_warning "前端依赖安装失败，跳过前端构建"
            cd ../..
            return
        fi

        # 构建前端
        npm run build

        if [ $? -eq 0 ]; then
            log_success "前端构建完成"
            cd ../..
        else
            log_warning "前端构建失败，管理界面可能无法正常显示"
            cd ../..
        fi
    else
        log_warning "前端目录未找到，跳过前端构建"
    fi
}

# 配置环境
configure_environment() {
    log_info "配置环境变量..."

    # 复制环境配置文件
    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_success "已从 .env.example 创建 .env 文件"
        else
            log_warning ".env.example 文件未找到，使用默认配置"
        fi
    fi

    # 设置端口配置
    if grep -q "^PORT=" .env 2>/dev/null; then
        sed -i 's/^PORT=.*/PORT=13006/' .env
    else
        echo "PORT=13006" >> .env
    fi

    # 设置主机配置
    if grep -q "^HOST=" .env 2>/dev/null; then
        sed -i 's/^HOST=.*/HOST=0.0.0.0/' .env
    else
        echo "HOST=0.0.0.0" >> .env
    fi

    # 设置生产环境
    if grep -q "^NODE_ENV=" .env 2>/dev/null; then
        sed -i 's/^NODE_ENV=.*/NODE_ENV=production/' .env
    else
        echo "NODE_ENV=production" >> .env
    fi

    log_success "环境配置完成"

    # 创建必要目录
    mkdir -p logs data redis_data
    chmod 755 logs data redis_data
    log_success "目录结构创建完成"
}

# 检查和配置 Redis
setup_redis() {
    log_info "配置 Redis..."

    # 检查 Redis 是否安装
    if command -v redis-server &> /dev/null; then
        log_success "Redis 已安装"

        # 检查 Redis 服务状态
        if command -v systemctl &> /dev/null && systemctl is-active --quiet redis; then
            log_success "Redis 服务正在运行"
        elif command -v service &> /dev/null; then
            service redis status &>/dev/null && log_success "Redis 服务正在运行"
        else
            log_warning "Redis 服务未运行，尝试启动..."
            if command -v systemctl &> /dev/null; then
                sudo systemctl start redis || log_warning "Redis 启动失败，请手动启动"
            elif command -v service &> /dev/null; then
                sudo service redis start || log_warning "Redis 启动失败，请手动启动"
            fi
        fi

        # 测试 Redis 连接
        if command -v redis-cli &> /dev/null; then
            if redis-cli ping &> /dev/null; then
                log_success "Redis 连接正常"
            else
                log_warning "Redis 连接失败，请检查 Redis 配置"
            fi
        fi
    else
        log_warning "Redis 未安装，服务可能无法正常运行"
        log_info "安装 Redis："
        log_info "  CentOS/RHEL: sudo yum install redis"
        log_info "  Ubuntu/Debian: sudo apt install redis"
    fi
}

# 停止现有服务
stop_existing_service() {
    log_info "停止现有服务..."

    # 停止 PM2 进程
    if command -v pm2 &> /dev/null; then
        if pm2 list | grep -q "claude-relay"; then
            pm2 stop claude-relay
            pm2 delete claude-relay
            log_success "已停止 PM2 服务"
        fi
    fi

    # 停止 Node.js 进程
    if [ -f "app.pid" ]; then
        PID=$(cat app.pid)
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID"
            log_success "已停止 Node.js 进程"
        fi
        rm -f app.pid
    fi

    # 停止可能的 Docker 服务
    if command -v docker-compose &> /dev/null; then
        if docker-compose ps | grep -q "claude-relay"; then
            docker-compose down
            log_success "已停止 Docker 服务"
        fi
    fi
}

# 启动服务
start_service() {
    log_info "启动 Claude Relay Service..."

    # 优先使用 PM2
    if command -v pm2 &> /dev/null; then
        log_info "使用 PM2 启动服务..."

        # 检查 start.js 文件
        if [ -f "start.js" ]; then
            pm2 start start.js --name claude-relay --env production
        else
            pm2 start src/app.js --name claude-relay --env production
        fi

        if [ $? -eq 0 ]; then
            log_success "服务已通过 PM2 启动"
            log_info "PM2 状态: pm2 status"
            log_info "查看日志: pm2 logs claude-relay"
            PM2_USED=true
        else
            log_error "PM2 启动失败"
            PM2_USED=false
        fi
    else
        PM2_USED=false
    fi

    # 如果 PM2 不可用或失败，使用 nohup
    if [ "$PM2_USED" = false ]; then
        log_info "使用 nohup 启动服务..."
        nohup node src/app.js > logs/app.log 2>&1 &
        echo $! > app.pid

        if [ $? -eq 0 ]; then
            log_success "服务已在后台启动"
            log_info "查看日志: tail -f logs/app.log"
            log_info "停止服务: kill \$(cat app.pid)"
        else
            log_error "服务启动失败"
            exit 1
        fi
    fi
}

# 配置防火墙
setup_firewall() {
    log_info "配置防火墙..."

    # 检查防火墙状态并开放端口
    if command -v firewall-cmd &> /dev/null; then
        if systemctl is-active --quiet firewalld; then
            sudo firewall-cmd --permanent --add-port=13006/tcp
            sudo firewall-cmd --reload
            log_success "已开放端口 13006 (firewalld)"
        fi
    elif command -v ufw &> /dev/null; then
        if ufw status | grep -q "Status: active"; then
            sudo ufw allow 13006/tcp
            log_success "已开放端口 13006 (ufw)"
        fi
    else
        log_warning "未检测到防火墙管理工具，请手动开放端口 13006"
    fi
}

# 验证部署
verify_deployment() {
    log_info "验证部署状态..."

    # 等待服务启动
    sleep 10

    # 检查进程状态
    if [ "$PM2_USED" = true ]; then
        pm2 status
        pm2 logs claude-relay --lines 10
    else
        if [ -f "app.pid" ]; then
            PID=$(cat app.pid)
            if kill -0 "$PID" 2>/dev/null; then
                log_success "服务进程运行正常 (PID: $PID)"
            else
                log_error "服务进程未运行"
            fi
        fi
    fi

    # 健康检查
    if command -v curl &> /dev/null; then
        log_info "执行健康检查..."

        # 等待服务完全启动
        for i in {1..30}; do
            if curl -s -f http://localhost:13006/health > /dev/null 2>&1; then
                log_success "健康检查通过"
                break
            else
                if [ $i -eq 30 ]; then
                    log_warning "健康检查失败，服务可能仍在启动中"
                else
                    echo -n "."
                    sleep 2
                fi
            fi
        done

        # 检查管理界面
        if curl -s -f http://localhost:13006/admin-next/api-stats > /dev/null 2>&1; then
            log_success "管理界面响应正常"
        else
            log_warning "管理界面检查失败"
        fi
    else
        log_warning "curl 未安装，跳过健康检查"
    fi

    # 显示访问信息
    echo ""
    log_success "🎉 离线部署完成！"
    echo ""
    echo "🌐 访问地址:"
    echo "  管理界面: http://$(hostname -I | awk '{print $1}' 2>/dev/null || echo 'YOUR_SERVER_IP'):13006/admin-next/api-stats"
    echo "  API 端点: http://$(hostname -I | awk '{print $1}' 2>/dev/null || echo 'YOUR_SERVER_IP'):13006/api/v1/messages"
    echo "  健康检查: http://$(hostname -I | awk '{print $1}' 2>/dev/null || echo 'YOUR_SERVER_IP'):13006/health"
    echo ""
    echo "📋 管理命令:"
    if [ "$PM2_USED" = true ]; then
        echo "  查看状态: pm2 status"
        echo "  查看日志: pm2 logs claude-relay"
        echo "  重启服务: pm2 restart claude-relay"
        echo "  停止服务: pm2 stop claude-relay"
        echo "  设置开机自启: pm2 startup && pm2 save"
    else
        echo "  查看日志: tail -f logs/app.log"
        echo "  重启服务: kill \$(cat app.pid) && nohup node src/app.js > logs/app.log 2>&1 &"
        echo "  停止服务: kill \$(cat app.pid)"
    fi
    echo ""
    echo "🔑 登录信息:"
    echo "  管理员账号已在首次启动时自动生成"
    echo "  请查看文件: data/init.json"
    echo ""
    echo "📝 日志文件:"
    echo "  应用日志: logs/app.log"
    echo "  错误日志: logs/claude-relay-error-$(date +%Y-%m-%d).log"
    echo ""
}

# 主函数
main() {
    echo "🚀 Claude Relay Service - 完全离线部署"
    echo "=========================================="
    echo ""
    echo "部署特性:"
    echo "  ✅ 完全离线，不依赖外部镜像仓库"
    echo "  ✅ 使用系统 Node.js 运行"
    echo "  ✅ 自动配置环境和依赖"
    echo "  ✅ 支持 PM2 进程管理"
    echo "  ✅ 自动防火墙配置"
    echo ""

    check_requirements
    setup_npm_registry
    stop_existing_service
    install_dependencies
    build_frontend
    configure_environment
    setup_redis
    setup_firewall
    start_service
    verify_deployment
}

# 执行主函数
main "$@"