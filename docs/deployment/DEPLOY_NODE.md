# 🚀 Claude Relay Service - Node.js 直接部署

## 📋 系统要求
- Node.js 18.0.0 或更高版本
- Redis 服务器
- PM2 (进程管理器，可选)

## 🚀 快速部署

### 1. 安装依赖
```bash
npm install --production
```

### 2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，设置必要的配置
```

### 3. 构建前端（如果需要）
```bash
npm run build:web
```

### 4. 启动服务

#### 直接启动
```bash
npm start
```

#### 使用 PM2 启动（推荐生产环境）
```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start start.js --name claude-relay

# 查看状态
pm2 status

# 查看日志
pm2 logs claude-relay

# 设置开机自启
pm2 startup
pm2 save
```

## 🌐 访问地址
- 管理界面: http://your-server:13006/admin-next/api-stats
- API 端点: http://your-server:13006/api/v1/messages
- 健康检查: http://your-server:13006/health

## 🔧 端口配置
默认端口为 13006，可以通过环境变量 PORT 修改：
```bash
export PORT=13006
npm start
```

## 📊 Redis 配置
确保 Redis 服务正在运行，并在 .env 文件中配置连接信息：
```env
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password
```

## 🛠️ 故障排除

### 1. 端口被占用
```bash
# 查看端口占用
netstat -tlnp | grep :13006

# 杀死占用进程
kill -9 <PID>
```

### 2. Redis 连接失败
```bash
# 检查 Redis 状态
redis-cli ping

# 启动 Redis
systemctl start redis
```

### 3. 权限问题
```bash
# 确保有写入权限
mkdir -p logs data
chmod 755 logs data
```