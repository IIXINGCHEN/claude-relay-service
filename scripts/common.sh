#!/bin/bash

# 🔧 Claude Relay Service - Common Script Library
# Shared functions for all deployment and management scripts

# ============================================
# Color Definitions
# ============================================
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export CYAN='\033[0;36m'
export BOLD='\033[1m'
export NC='\033[0m' # No Color

# ============================================
# Logging Functions
# ============================================
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

log_step() {
    echo -e "${CYAN}[$1]${NC} $2"
}

log_bold() {
    echo -e "${BOLD}$1${NC}"
}

# ============================================
# System Detection
# ============================================
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        export OS="Linux"
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            export DISTRO=$ID
            export DISTRO_VERSION=$VERSION_ID
            export DISTRO_NAME=$PRETTY_NAME
        else
            export DISTRO="unknown"
            export DISTRO_VERSION="unknown"
            export DISTRO_NAME="Unknown Linux Distribution"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        export OS="macOS"
        export DISTRO="macos"
        export DISTRO_VERSION=$(sw_vers -productVersion)
        export DISTRO_NAME="macOS $DISTRO_VERSION"
    else
        export OS="Unknown"
        export DISTRO="unknown"
        export DISTRO_VERSION="unknown"
        export DISTRO_NAME="Unknown Operating System"
    fi
}

# ============================================
# Package Manager Detection
# ============================================
detect_package_manager() {
    if command -v apt-get &> /dev/null; then
        export PKG_MANAGER="apt"
        export PKG_INSTALL="sudo apt-get update && sudo apt-get install -y"
    elif command -v yum &> /dev/null; then
        export PKG_MANAGER="yum"
        export PKG_INSTALL="sudo yum install -y"
    elif command -v dnf &> /dev/null; then
        export PKG_MANAGER="dnf"
        export PKG_INSTALL="sudo dnf install -y"
    elif command -v brew &> /dev/null; then
        export PKG_MANAGER="brew"
        export PKG_INSTALL="brew install"
    else
        export PKG_MANAGER="unknown"
        export PKG_INSTALL="echo '请手动安装'"
    fi
}

# ============================================
# Node.js Version Check
# ============================================
check_node_version() {
    log_info "检查 Node.js 版本..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装，请先安装 Node.js 18 或更高版本"
        log_info "访问: https://nodejs.org/"
        return 1
    fi

    local node_version=$(node --version)
    local major_version=$(echo $node_version | cut -d'.' -f1 | sed 's/v//')

    log_info "当前 Node.js 版本: $node_version"

    if [ "$major_version" -lt 18 ]; then
        log_error "Node.js 版本过低！需要 18.0.0 或更高版本"
        return 1
    fi

    log_success "Node.js 版本检查通过"
    return 0
}

# ============================================
# Docker Check
# ============================================
check_docker() {
    log_info "检查 Docker 服务状态..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装"
        return 1
    fi

    if ! docker info &> /dev/null; then
        log_warning "Docker 服务未运行，正在启动..."
        if command -v systemctl &> /dev/null; then
            sudo systemctl start docker
            sleep 3
        else
            log_error "无法启动 Docker 服务"
            return 1
        fi
    fi

    log_success "Docker 服务正常"
    return 0
}

# ============================================
# Redis Connection Check
# ============================================
check_redis_connection() {
    log_info "检查 Redis 连接..."

    if ! command -v redis-cli &> /dev/null; then
        log_warning "redis-cli 未安装，跳过 Redis 检查"
        return 1
    fi

    # Load Redis config from .env if exists
    local redis_host="${REDIS_HOST:-localhost}"
    local redis_port="${REDIS_PORT:-6379}"
    local redis_password="${REDIS_PASSWORD:-}"

    if [ -f ".env" ]; then
        while IFS='=' read -r key value; do
            [[ $key =~ ^[[:space:]]*# ]] && continue
            [[ -z $key ]] && continue
            case $key in
                REDIS_HOST) redis_host=$value ;;
                REDIS_PORT) redis_port=$value ;;
                REDIS_PASSWORD) redis_password=$value ;;
            esac
        done < .env
    fi

    # Test connection
    local redis_cmd="redis-cli -h $redis_host -p $redis_port"
    if [ -n "$redis_password" ]; then
        redis_cmd="$redis_cmd -a $redis_password"
    fi

    if $redis_cmd ping &> /dev/null; then
        log_success "Redis 连接成功"
        return 0
    else
        log_warning "Redis 连接失败"
        return 1
    fi
}

# ============================================
# Project Directory Setup
# ============================================
setup_project_dir() {
    local project_dir="${PROJECT_DIR:-$(pwd)}"
    
    if [ ! -d "$project_dir" ]; then
        log_error "项目目录不存在: $project_dir"
        log_info "请设置环境变量: export PROJECT_DIR=/path/to/project"
        return 1
    fi

    cd "$project_dir" || return 1
    export PROJECT_DIR="$project_dir"
    log_success "项目目录: $(pwd)"
    return 0
}

# ============================================
# Environment File Setup
# ============================================
setup_env_file() {
    log_info "检查环境配置..."

    if [ ! -f ".env" ]; then
        if [ -f ".env.example" ]; then
            log_warning ".env 文件不存在，正在从 .env.example 复制..."
            cp .env.example .env
            log_info "已创建 .env 文件，请根据需要修改配置"
        else
            log_warning ".env 文件不存在，将使用默认配置"
        fi
    else
        log_success ".env 文件存在"
    fi

    # Check config.js
    if [ ! -f "config/config.js" ] && [ -f "config/config.example.js" ]; then
        log_info "复制配置文件模板..."
        cp config/config.example.js config/config.js
    fi

    return 0
}

# ============================================
# NPM Dependencies Check
# ============================================
check_npm_dependencies() {
    log_info "检查项目依赖..."

    if [ ! -d "node_modules" ]; then
        log_warning "node_modules 目录不存在，需要安装依赖"
        return 1
    fi

    # Check critical dependencies
    local critical_deps=("express" "winston" "ioredis")
    for dep in "${critical_deps[@]}"; do
        if [ ! -d "node_modules/$dep" ]; then
            log_warning "关键依赖缺失: $dep"
            return 1
        fi
    done

    log_success "依赖检查通过"
    return 0
}

# ============================================
# Install NPM Dependencies
# ============================================
install_npm_dependencies() {
    log_info "安装项目依赖..."
    
    if ! npm install --production; then
        log_error "依赖安装失败"
        return 1
    fi

    log_success "依赖安装完成"
    return 0
}

# ============================================
# Health Check
# ============================================
health_check() {
    local port="${1:-13006}"
    local max_retries="${2:-30}"
    
    log_info "执行健康检查..."

    if ! command -v curl &> /dev/null; then
        log_warning "curl 未安装，跳过健康检查"
        return 1
    fi

    for i in $(seq 1 $max_retries); do
        if curl -s -f "http://localhost:$port/health" > /dev/null 2>&1; then
            log_success "健康检查通过"
            return 0
        else
            if [ $i -eq $max_retries ]; then
                log_warning "健康检查失败"
                return 1
            fi
            echo -n "."
            sleep 2
        fi
    done
}

# ============================================
# Display Service Info
# ============================================
display_service_info() {
    local port="${1:-13006}"
    local ip_addr=$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'YOUR_SERVER_IP')
    
    echo ""
    log_success "🎉 服务部署完成！"
    echo ""
    echo "🌐 访问地址:"
    echo "  管理界面: http://$ip_addr:$port/admin-next/api-stats"
    echo "  API 端点: http://$ip_addr:$port/api/v1/messages"
    echo "  健康检查: http://$ip_addr:$port/health"
    echo ""
    echo "🔑 登录信息:"
    echo "  管理员账号已在首次启动时自动生成"
    echo "  请查看文件: data/init.json"
    echo ""
}

# ============================================
# Exports (make functions available to sourcing scripts)
# ============================================
export -f log_info log_success log_warning log_error log_step log_bold
export -f detect_os detect_package_manager
export -f check_node_version check_docker check_redis_connection
export -f setup_project_dir setup_env_file
export -f check_npm_dependencies install_npm_dependencies
export -f health_check display_service_info
