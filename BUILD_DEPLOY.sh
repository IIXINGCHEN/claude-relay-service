#!/bin/bash

# 🚀 Claude Relay Service - 远程服务器构建部署脚本

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

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# 检查当前目录 - 使用当前目录或环境变量指定
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || {
    log_error "无法切换到项目目录: $PROJECT_DIR"
    log_info "请设置环境变量: export PROJECT_DIR=/path/to/project"
    exit 1
}

log_info "当前目录: $(pwd)"

# 检查 Docker 状态
check_docker() {
    log_info "检查 Docker 服务状态..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装"
        exit 1
    fi

    if ! systemctl is-active --quiet docker; then
        log_warning "Docker 服务未运行，正在启动..."
        sudo systemctl start docker
        sleep 3
    fi

    log_success "Docker 服务正常"
}

# 构建 Docker 镜像
build_image() {
    log_info "构建 Docker 镜像..."

    # 检查 Dockerfile
    if [ -f "Dockerfile.offline" ]; then
        DOCKERFILE="Dockerfile.offline"
        log_info "使用离线版 Dockerfile"
    elif [ -f "Dockerfile" ]; then
        DOCKERFILE="Dockerfile"
        log_info "使用标准 Dockerfile"
    else
        log_error "未找到 Dockerfile"
        exit 1
    fi

    # 构建镜像
    docker build -f "$DOCKERFILE" -t claude-relay-service:local .

    if [ $? -eq 0 ]; then
        log_success "镜像构建成功"
        docker images | grep claude-relay-service
    else
        log_error "镜像构建失败"
        exit 1
    fi
}

# 检查和创建前端构建文件
check_frontend() {
    log_info "检查前端构建文件..."

    if [ ! -d "web/admin-spa/dist" ]; then
        log_warning "前端构建文件未找到，正在构建..."

        if [ -d "web/admin-spa" ] && [ -f "web/admin-spa/package.json" ]; then
            cd web/admin-spa
            npm install
            npm run build
            cd ../..
            log_success "前端构建完成"
        else
            log_warning "前端源码未找到，管理界面可能无法正常显示"
        fi
    else
        log_success "前端构建文件已存在"
    fi
}

# 启动服务
start_service() {
    log_info "启动服务..."

    # 停止现有服务
    if docker-compose ps | grep -q "claude-relay"; then
        log_info "停止现有服务..."
        docker-compose down
    fi

    # 启动新服务
    docker-compose up -d

    if [ $? -eq 0 ]; then
        log_success "服务启动成功"
    else
        log_error "服务启动失败"
        exit 1
    fi
}

# 验证部署
verify_deployment() {
    log_info "验证部署状态..."

    # 等待服务启动
    sleep 10

    # 检查容器状态
    docker-compose ps

    # 检查服务日志
    log_info "最近的日志:"
    docker-compose logs --tail=20 claude-relay

    # 健康检查
    sleep 5
    if command -v curl &> /dev/null; then
        if curl -s -f http://localhost:13006/health > /dev/null; then
            log_success "健康检查通过"
            curl -s http://localhost:13006/health | head -n 5
        else
            log_warning "健康检查失败，请检查日志"
        fi
    else
        log_warning "curl 未安装，跳过健康检查"
    fi

    # 显示访问信息
    echo ""
    log_success "🎉 部署完成！"
    echo ""
    echo "🌐 访问地址:"
    echo "  管理界面: http://$(hostname -I | awk '{print $1}' 2>/dev/null || echo 'your-server-ip'):13006/admin-next/api-stats"
    echo "  API 端点: http://$(hostname -I | awk '{print $1}' 2>/dev/null || echo 'your-server-ip'):13006/api/v1/messages"
    echo "  健康检查: http://$(hostname -I | awk '{print $1}' 2>/dev/null || echo 'your-server-ip'):13006/health"
    echo ""
    echo "📋 管理命令:"
    echo "  查看状态: docker-compose ps"
    echo "  查看日志: docker-compose logs claude-relay"
    echo "  重启服务: docker-compose restart claude-relay"
    echo "  停止服务: docker-compose down"
    echo ""
}

# 主函数
main() {
    echo "🚀 Claude Relay Service - 远程服务器构建部署"
    echo "=============================================="
    echo ""

    check_docker
    check_frontend
    build_image
    start_service
    verify_deployment
}

# 执行主函数
main "$@"