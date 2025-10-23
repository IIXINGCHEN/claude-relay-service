#!/bin/bash

# ��� Claude Relay Service - 使用镜像加速器构建部署

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

# 镜像加速器地址
MIRROR_REGISTRY="docker.1panel.live"

# 检查当前目录 - 使用当前目录或环境变量指定
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"
cd "$PROJECT_DIR" || {
    log_error "无法切换到项目目录: $PROJECT_DIR"
    log_info "请设置环境变量: export PROJECT_DIR=/path/to/project"
    exit 1
}

log_info "当前目录: $(pwd)"
log_info "使用镜像加速器: $MIRROR_REGISTRY"

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

# 配置 Docker 镜像加速器
setup_docker_mirror() {
    log_info "配置 Docker 镜像加速器..."

    # 创建或更新 Docker daemon 配置
    DOCKER_CONFIG="/etc/docker/daemon.json"

    if [ ! -f "$DOCKER_CONFIG" ]; then
        log_info "创建 Docker daemon 配置文件..."
        sudo mkdir -p /etc/docker
        echo '{
  "registry-mirrors": [
    "https://docker.1panel.live"
  ]
}' | sudo tee "$DOCKER_CONFIG"
    else
        log_info "更新 Docker daemon 配置..."
        # 备份原配置
        sudo cp "$DOCKER_CONFIG" "$DOCKER_CONFIG.backup.$(date +%s)"

        # 更新配置
        sudo jq '.registry-mirrors = ["https://docker.1panel.live"]' "$DOCKER_CONFIG" | sudo tee "$DOCKER_CONFIG.tmp"
        sudo mv "$DOCKER_CONFIG.tmp" "$DOCKER_CONFIG"
    fi

    # 重启 Docker 服务
    log_info "重启 Docker 服务以应用镜像加速器配置..."
    sudo systemctl restart docker
    sleep 5

    # 验证配置
    if docker info | grep -q "Registry Mirrors"; then
        log_success "Docker 镜像加速器配置成功"
        docker info | grep -A 2 "Registry Mirrors"
    else
        log_warning "Docker 镜像加速器配置可能未生效，但继续尝试构建"
    fi
}

# 测试镜像加速器
test_mirror() {
    log_info "测试镜像加速器连接..."

    # 测试拉取小镜像
    if timeout 30 docker pull $MIRROR_REGISTRY/library/alpine:latest > /dev/null 2>&1; then
        log_success "镜像加速器连接正常"
        docker rmi $MIRROR_REGISTRY/library/alpine:latest > /dev/null 2>&1
    else
        log_warning "镜像加速器连接测试失败，尝试直接构建"
    fi
}

# 构建前端（如果需要）
build_frontend() {
    log_info "检查前端构建文件..."

    if [ ! -d "web/admin-spa/dist" ]; then
        log_warning "前端构建文件未找到，正在构建..."

        if [ -d "web/admin-spa" ] && [ -f "web/admin-spa/package.json" ]; then
            cd web/admin-spa

            # 设置 npm 镜像源
            npm config set registry https://registry.npmmirror.com

            npm install
            npm run build
            cd ../..

            if [ -d "web/admin-spa/dist" ]; then
                log_success "前端构建完成"
            else
                log_warning "前端构建失败，管理界面可能无法显示"
            fi
        else
            log_warning "前端源码未找到，跳过前端构建"
        fi
    else
        log_success "前端构建文件已存在"
    fi
}

# 构建 Docker 镜像
build_image() {
    log_info "构建 Docker 镜像..."

    # 停止可能占用资源的容器
    docker-compose down > /dev/null 2>&1 || true

    # 删除旧镜像
    if docker images | grep -q "claude-relay-service:local"; then
        docker rmi claude-relay-service:local > /dev/null 2>&1 || true
        log_info "已删除旧镜像"
    fi

    # 选择 Dockerfile
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
    log_info "开始构建镜像（可能需要几分钟）..."
    docker build -f "$DOCKERFILE" -t claude-relay-service:local .

    if [ $? -eq 0 ]; then
        log_success "镜像构建成功"
        docker images | grep claude-relay-service
    else
        log_error "镜像构建失败"
        log_info "尝试 Node.js 直接部署方案..."
        exit 1
    fi
}

# 启动服务
start_service() {
    log_info "启动服务..."

    # 设置端口
    export PORT=13006

    # 选择 docker-compose 文件
    if [ -f "docker-compose-offline.yml" ]; then
        COMPOSE_FILE="docker-compose-offline.yml"
        log_info "使用离线版 docker-compose 配置"
    elif [ -f "docker-compose.yml" ]; then
        COMPOSE_FILE="docker-compose.yml"
        log_info "使用标准 docker-compose 配置"
    else
        log_error "未找到 docker-compose 配置文件"
        exit 1
    fi

    # 启动服务
    docker-compose -f "$COMPOSE_FILE" up -d

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
    sleep 15

    # 检查容器状态
    log_info "容器状态:"
    docker-compose -f "${COMPOSE_FILE:-docker-compose.yml}" ps

    # 检查服务日志
    log_info "服务启动日志:"
    docker-compose logs --tail=15 claude-relay

    # 健康检查
    log_info "执行健康检查..."
    sleep 5

    if command -v curl &> /dev/null; then
        # 测试健康检查
        for i in {1..10}; do
            if curl -s -f http://localhost:13006/health > /dev/null 2>&1; then
                log_success "健康检查通过"
                curl -s http://localhost:13006/health | head -n 3
                break
            else
                if [ $i -eq 10 ]; then
                    log_warning "健康检查失败，服务可能仍在启动中"
                else
                    echo -n "."
                    sleep 3
                fi
            fi
        done

        # 测试管理界面
        if curl -s -f http://localhost:13006/admin-next/api-stats > /dev/null 2>&1; then
            log_success "管理界面响应正常"
        else
            log_warning "管理界面检查失败，请查看日志"
        fi
    else
        log_warning "curl 未安装，跳过健康检查"
    fi

    # 显示访问信息
    echo ""
    log_success "🎉 使用镜像加速器部署完成！"
    echo ""
    echo "🌐 访问地址:"
    echo "  管理界面: http://$(hostname -I | awk '{print $1}' 2>/dev/null || echo 'YOUR_SERVER_IP'):13006/admin-next/api-stats"
    echo "  API 端点: http://$(hostname -I | awk '{print $1}' 2>/dev/null || echo 'YOUR_SERVER_IP'):13006/api/v1/messages"
    echo "  健康检查: http://$(hostname -I | awk '{print $1}' 2>/dev/null || echo 'YOUR_SERVER_IP'):13006/health"
    echo ""
    echo "📋 管理命令:"
    echo "  查看状态: docker-compose ps"
    echo "  查看日志: docker-compose logs claude-relay"
    echo "  重启服务: docker-compose restart claude-relay"
    echo "  停止服务: docker-compose down"
    echo "  重新构建: docker build -f Dockerfile.offline -t claude-relay-service:local ."
    echo ""
    echo "🔑 登录信息:"
    echo "  管理员账号已在首次启动时自动生成"
    echo "  请查看文件: data/init.json"
    echo "  或查看容器日志: docker-compose logs claude-relay | grep -A 5 '管理员账号'"
    echo ""
    echo "🔧 镜像信息:"
    echo "  使用的镜像加速器: $MIRROR_REGISTRY"
    echo "  应用镜像: claude-relay-service:local"
    echo "  Redis 镜像: $MIRROR_REGISTRY/library/redis:7-alpine"
    echo ""
}

# 主函数
main() {
    echo "🚀 Claude Relay Service - 使用镜像加速器构建部署"
    echo "=================================================="
    echo ""
    echo "部署特性:"
    echo "  ✅ 使用镜像加速器: $MIRROR_REGISTRY"
    echo "  ✅ 自动配置 Docker 镜像源"
    echo "  ✅ 包含 CSP 修复"
    echo "  ✅ 端口 13006"
    echo "  ✅ 完整的容器化部署"
    echo ""

    check_docker
    setup_docker_mirror
    test_mirror
    build_frontend
    build_image
    start_service
    verify_deployment
}

# 错误处理
trap 'log_error "部署过程中发生错误，请检查日志"; exit 1' ERR

# 执行主函数
main "$@"