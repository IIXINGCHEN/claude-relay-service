#!/bin/bash

# Claude Relay Service - 一键启动脚本 (跨平台)
#
# 支持的操作系统:
#   - Linux: Ubuntu, Debian, CentOS, RHEL, Fedora, openSUSE, Arch Linux 等
#   - macOS: 所有版本
#   - Windows (WSL)
#
# 使用方法:
#   chmod +x start.sh
#   ./start.sh
#

set -e  # 遇到错误时退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# 日志函数
log() {
    echo -e "${NC}$1${NC}"
}

log_step() {
    echo -e "${CYAN}[$1] $2${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_bold() {
    echo -e "${BOLD}$1${NC}"
}

# 操作系统检测
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="Linux"
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            DISTRO=$ID
            DISTRO_VERSION=$VERSION_ID
            DISTRO_NAME=$PRETTY_NAME
        elif [ -f /etc/redhat-release ]; then
            DISTRO="rhel"
            DISTRO_VERSION=$(cat /etc/redhat-release | grep -oE '[0-9]+\.[0-9]+' | head -1)
            DISTRO_NAME=$(cat /etc/redhat-release)
        elif [ -f /etc/debian_version ]; then
            DISTRO="debian"
            DISTRO_VERSION=$(cat /etc/debian_version)
            DISTRO_NAME="Debian $(cat /etc/debian_version)"
        else
            DISTRO="unknown"
            DISTRO_VERSION="unknown"
            DISTRO_NAME="Unknown Linux Distribution"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macOS"
        DISTRO="macos"
        DISTRO_VERSION=$(sw_vers -productVersion)
        DISTRO_NAME="macOS $DISTRO_VERSION"
    elif [[ "$OSTYPE" == "cygwin" ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
        OS="Windows"
        DISTRO="windows"
        DISTRO_VERSION="unknown"
        DISTRO_NAME="Windows (via $OSTYPE)"
    else
        OS="Unknown"
        DISTRO="unknown"
        DISTRO_VERSION="unknown"
        DISTRO_NAME="Unknown Operating System ($OSTYPE)"
    fi
}

# 显示操作系统信息
show_os_info() {
    log_info "检测到操作系统: $OS"
    log_info "发行版: $DISTRO_NAME"
    if [ "$OS" = "Linux" ]; then
        log_info "发行版ID: $DISTRO"
        log_info "版本: $DISTRO_VERSION"
    fi
}

# 检查包管理器
detect_package_manager() {
    if command -v apt-get &> /dev/null; then
        PKG_MANAGER="apt"
        PKG_INSTALL="sudo apt-get update && sudo apt-get install -y"
        PKG_SEARCH="apt-cache search"
    elif command -v yum &> /dev/null; then
        PKG_MANAGER="yum"
        PKG_INSTALL="sudo yum install -y"
        PKG_SEARCH="yum search"
    elif command -v dnf &> /dev/null; then
        PKG_MANAGER="dnf"
        PKG_INSTALL="sudo dnf install -y"
        PKG_SEARCH="dnf search"
    elif command -v zypper &> /dev/null; then
        PKG_MANAGER="zypper"
        PKG_INSTALL="sudo zypper install -y"
        PKG_SEARCH="zypper search"
    elif command -v pacman &> /dev/null; then
        PKG_MANAGER="pacman"
        PKG_INSTALL="sudo pacman -S --noconfirm"
        PKG_SEARCH="pacman -Ss"
    elif command -v brew &> /dev/null; then
        PKG_MANAGER="brew"
        PKG_INSTALL="brew install"
        PKG_SEARCH="brew search"
    else
        PKG_MANAGER="unknown"
        PKG_INSTALL="echo '请手动安装'"
        PKG_SEARCH="echo '请手动搜索'"
    fi
}

# 获取 Node.js 安装命令
get_nodejs_install_command() {
    case "$DISTRO" in
        ubuntu|debian)
            echo "curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - && sudo apt-get install -y nodejs"
            ;;
        centos|rhel|fedora)
            echo "curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash - && sudo $PKG_MANAGER install -y nodejs"
            ;;
        opensuse-leap|opensuse-tumbleweed)
            echo "sudo zypper addrepo https://download.opensuse.org/repositories/devel:/languages:/nodejs/openSUSE_Leap_\$releasever/ devel:languages:nodejs.repo && sudo zypper refresh && sudo zypper install -y nodejs nodejs-devel"
            ;;
        arch)
            echo "sudo pacman -S --noconfirm nodejs npm"
            ;;
        macos)
            echo "brew install node"
            ;;
        *)
            echo "请参考 https://nodejs.org/ 下载适合您系统的 Node.js 安装包"
            ;;
    esac
}

# 获取 Redis 安装命令
get_redis_install_command() {
    case "$DISTRO" in
        ubuntu|debian)
            echo "sudo apt-get update && sudo apt-get install -y redis-server"
            ;;
        centos|rhel)
            echo "sudo yum install -y epel-release && sudo yum install -y redis"
            ;;
        fedora)
            echo "sudo dnf install -y redis"
            ;;
        opensuse-leap|opensuse-tumbleweed)
            echo "sudo zypper install -y redis"
            ;;
        arch)
            echo "sudo pacman -S --noconfirm redis"
            ;;
        macos)
            echo "brew install redis"
            ;;
        *)
            echo "请参考 https://redis.io/download 安装适合您系统的 Redis"
            ;;
    esac
}

# 获取 Redis 启动命令
get_redis_start_command() {
    case "$DISTRO" in
        ubuntu|debian|centos|rhel|fedora|opensuse-leap|opensuse-tumbleweed)
            echo "sudo systemctl start redis && sudo systemctl enable redis"
            ;;
        arch)
            echo "sudo systemctl start redis && sudo systemctl enable redis"
            ;;
        macos)
            echo "brew services start redis"
            ;;
        *)
            echo "redis-server"
            ;;
    esac
}

# 检查 Node.js 版本
check_node_version() {
    log_step 1 "检查 Node.js 版本..."

    if ! command -v node &> /dev/null; then
        log_error "未找到 Node.js，请先安装 Node.js 18 或更高版本"
        log_info "检测到的系统: $DISTRO_NAME"
        log_info "安装命令:"
        log_info "  $(get_nodejs_install_command)"
        log_info "或者访问: https://nodejs.org/"
        exit 1
    fi

    NODE_VERSION=$(node --version)
    NODE_MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')

    log_info "当前 Node.js 版本: $NODE_VERSION"

    if [ "$NODE_MAJOR_VERSION" -lt 18 ]; then
        log_error "Node.js 版本过低！需要 18.0.0 或更高版本，当前版本: $NODE_VERSION"
        log_info "请升级 Node.js 或重新安装:"
        log_info "  $(get_nodejs_install_command)"
        exit 1
    fi

    log_success "Node.js 版本检查通过"
}

# 检查项目依赖
check_dependencies() {
    log_step 2 "检查项目依赖..."

    if [ ! -f "package.json" ]; then
        log_error "package.json 文件不存在！"
        exit 1
    fi

    # 检查 node_modules 是否存在
    if [ ! -d "node_modules" ]; then
        log_warning "node_modules 目录不存在，需要安装依赖"
        return 1
    fi

    # 检查关键依赖是否存在
    local critical_deps=("express" "winston" "ioredis")
    local missing_deps=()

    for dep in "${critical_deps[@]}"; do
        if [ ! -d "node_modules/$dep" ]; then
            missing_deps+=("$dep")
        fi
    done

    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_warning "关键依赖缺失: ${missing_deps[*]}"
        return 1
    fi

    # 检查 package-lock.json 是否存在
    if [ -f "package-lock.json" ]; then
        local node_modules_mtime=$(stat -c %Y node_modules 2>/dev/null || stat -f %m node_modules 2>/dev/null)
        local package_lock_mtime=$(stat -c %Y package-lock.json 2>/dev/null || stat -f %m package-lock.json 2>/dev/null)

        if [ "$node_modules_mtime" -lt "$package_lock_mtime" ]; then
            log_warning "package-lock.json 比 node_modules 更新，需要重新安装依赖"
            return 1
        fi
    fi

    log_success "依赖检查通过"
    return 0
}

# 安装依赖
install_dependencies() {
    log_step 3 "安装项目依赖..."
    log_info "正在执行 npm install..."

    if ! npm install; then
        log_error "依赖安装失败"
        exit 1
    fi

    log_success "依赖安装完成"
}

# 检查环境配置
check_environment() {
    log_step 4 "检查环境配置..."

    # 检查 .env 文件
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

    # 检查 config/config.js 文件
    if [ ! -f "config/config.js" ]; then
        if [ -f "config/config.example.js" ]; then
            log_warning "config.js 文件不存在，正在从 config.example.js 复制..."
            cp config/config.example.js config/config.js
            log_info "已创建 config.js 文件"
        fi
    else
        log_success "config.js 文件存在"
    fi

    return 0
}

# 检查 Redis 连接
check_redis_connection() {
    log_step 5 "检查 Redis 连接..."

    # 检查 redis-server 是否安装
    if ! command -v redis-server &> /dev/null && ! command -v redis-cli &> /dev/null; then
        log_warning "Redis 未安装"
        log_info "检测到的系统: $DISTRO_NAME"
        log_info "安装命令:"
        log_info "  $(get_redis_install_command)"
        return 1
    fi

    # 检查 Redis 服务是否运行
    if command -v redis-cli &> /dev/null; then
        # 从 .env 文件读取 Redis 配置
        local redis_host="localhost"
        local redis_port="6379"
        local redis_password=""

        if [ -f ".env" ]; then
            while IFS='=' read -r key value; do
                # 跳过注释和空行
                [[ $key =~ ^[[:space:]]*# ]] && continue
                [[ -z $key ]] && continue

                case $key in
                    REDIS_HOST) redis_host=$value ;;
                    REDIS_PORT) redis_port=$value ;;
                    REDIS_PASSWORD) redis_password=$value ;;
                esac
            done < .env
        fi

        # 尝试连接 Redis
        local redis_cmd="redis-cli -h $redis_host -p $redis_port"
        if [ -n "$redis_password" ]; then
            redis_cmd="$redis_cmd -a $redis_password"
        fi

        if $redis_cmd ping > /dev/null 2>&1; then
            log_success "Redis 连接成功"
            return 0
        else
            log_warning "Redis 服务未运行"
            log_info "启动命令:"
            log_info "  $(get_redis_start_command)"
            return 1
        fi
    else
        log_warning "redis-cli 命令不可用，无法检查 Redis 连接"
        return 1
    fi
}

# 启动生产环境服务
start_production_server() {
    log_step 6 "启动生产环境服务..."

    # 设置生产环境变量
    export NODE_ENV=production

    log_info "以生产模式启动 Claude Relay Service..."
    log_info "使用 Ctrl+C 停止服务"
    echo
    log_bold "============================================================"
    log_bold "🚀 Claude Relay Service 正在启动..."
    log_bold "============================================================"
    echo

    # 启动服务
    exec node src/app.js
}

# 信号处理
cleanup() {
    log_info ""
    log_bold "============================================================"
    log_info "收到停止信号，正在关闭服务..."
    log_bold "============================================================"
    exit 0
}

# 注册信号处理
trap cleanup SIGINT SIGTERM

# 主函数
main() {
    echo
    log_bold "============================================================"
    log_bold "🚀 Claude Relay Service - 一键启动脚本 (跨平台)"
    log_bold "============================================================"
    echo

    # 检查当前目录是否正确
    if [ ! -f "package.json" ]; then
        log_error "请在项目根目录运行此脚本"
        exit 1
    fi

    # 检测操作系统和包管理器
    detect_os
    detect_package_manager
    show_os_info

    # 1. 检查 Node.js 版本
    check_node_version

    # 2. 检查依赖
    if ! check_dependencies; then
        # 3. 安装依赖
        install_dependencies
    fi

    # 4. 检查环境配置
    check_environment

    # 5. 检查 Redis 连接（可选，不影响启动）
    check_redis_connection || true

    # 6. 启动服务
    start_production_server
}

# 运行主函数
main "$@"