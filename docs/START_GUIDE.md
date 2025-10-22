# Claude Relay Service - 一键启动指南

## 快速启动

### 方式一：使用 Node.js 脚本（推荐）
```bash
node start.js
```

### 方式二：使用 npm 脚本
```bash
npm run start:one-click
```

### 方式三：使用脚本文件

#### Windows
双击运行：
- `start.bat` (Windows 批处理)
- `start.ps1` (PowerShell)

#### Linux/macOS
```bash
# 给脚本添加执行权限
chmod +x start.sh

# 运行脚本
./start.sh
```

## 脚本功能

这个一键启动脚本会自动完成以下步骤：

1. **检查 Node.js 版本**
   - 确保使用 Node.js 18.0.0 或更高版本

2. **检查项目依赖**
   - 检查 `node_modules` 是否存在
   - 检查关键依赖包是否完整
   - 检查 `package-lock.json` 更新时间

3. **自动安装依赖**
   - 如果依赖缺失，自动运行 `npm install`

4. **检查环境配置**
   - 检查 `.env` 文件是否存在
   - 如果不存在，从 `.env.example` 复制
   - 检查 `config/config.js` 文件

5. **检查 Redis 连接**
   - 尝试连接 Redis 服务器
   - 如果连接失败会给出警告，但不影响启动

6. **以生产模式启动服务**
   - 设置 `NODE_ENV=production`
   - 启动 Claude Relay Service

## 使用说明

1. **首次运行**
   ```bash
   # 在项目根目录运行
   node start.js
   ```
   脚本会自动检查和安装依赖，然后启动服务。

2. **后续运行**
   如果依赖已安装，脚本会直接启动服务：
   ```bash
   node start.js
   ```

3. **停止服务**
   使用 `Ctrl+C` 停止服务。

4. **查看日志**
   服务启动后会显示实时日志，包括：
   - 服务启动状态
   - Redis 连接状态
   - API 端点地址
   - 错误信息（如果有）

## 服务地址

启动成功后，可以通过以下地址访问：

- **Web 管理界面**: http://127.0.0.1:3000/admin-next/api-stats
- **API 端点**: http://127.0.0.1:3000/api/v1/messages
- **管理员 API**: http://127.0.0.1:3000/admin
- **健康检查**: http://127.0.0.1:3000/health
- **系统指标**: http://127.0.0.1:3000/metrics

## 故障排除

### 1. Node.js 版本过低
```
❌ Node.js 版本过低！需要 18.0.0 或更高版本
```
请升级 Node.js 到 18 或更高版本。

### 2. Redis 连接失败
```
⚠️ Redis 连接失败
```
请确保 Redis 服务正在运行：
- Windows: 使用 `Start-Redis.ps1` 或手动启动 Redis
- Linux/Mac: `redis-server` 或 `systemctl start redis`

### 3. 依赖安装失败
```
❌ 依赖安装失败
```
请检查网络连接，或手动运行：
```bash
npm install
```

### 4. 端口被占用
```
Error: listen EADDRINUSE :::3000
```
请检查端口 3000 是否被其他程序占用，或修改 `.env` 文件中的 `PORT` 配置。

## 环境配置

脚本会自动检查并创建必要的配置文件：

1. **.env 文件**
   - 包含 Redis 连接、端口等配置
   - 首次运行会从 `.env.example` 复制

2. **config/config.js 文件**
   - 包含应用配置
   - 首次运行会从 `config/config.example.js` 复制

请根据实际需要修改这些配置文件。

## Linux/macOS 特殊说明

### 权限设置
首次使用前需要给脚本添加执行权限：
```bash
chmod +x start.sh
```

### Node.js 安装（如果没有安装）

#### Ubuntu/Debian
```bash
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### CentOS/RHEL
```bash
curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
sudo yum install -y nodejs
```

#### macOS
```bash
brew install node
```

### Redis 服务管理

#### Ubuntu/Debian
```bash
# 启动 Redis
sudo systemctl start redis

# 设置开机启动
sudo systemctl enable redis

# 检查状态
sudo systemctl status redis
```

#### CentOS/RHEL
```bash
# 启动 Redis
sudo systemctl start redis

# 设置开机启动
sudo systemctl enable redis

# 检查状态
sudo systemctl status redis
```

#### macOS
```bash
# 使用 Homebrew
brew services start redis

# 停止
brew services stop redis

# 重启
brew services restart redis
```

### 系统服务配置
可以将 start.sh 配置为系统服务：

#### systemd (Ubuntu/CentOS)
创建 `/etc/systemd/system/claude-relay.service`:
```ini
[Unit]
Description=Claude Relay Service
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/claude-relay-service
ExecStart=/path/to/claude-relay-service/start.sh
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl daemon-reload
sudo systemctl start claude-relay
sudo systemctl enable claude-relay
```

## 生产部署

在生产环境中使用：

### Linux/macOS
```bash
NODE_ENV=production ./start.sh
```

或使用 PM2 管理进程：
```bash
pm2 start start.js --name claude-relay-service
pm2 start start.sh --name claude-relay-service --interpreter bash
```

### Windows
```bash
NODE_ENV=production node start.js
```

## 日志文件

服务运行后，日志文件位于 `logs/` 目录：
- `claude-relay-YYYY-MM-DD.log` - 主要日志
- `claude-relay-error-YYYY-MM-DD.log` - 错误日志
- `claude-relay-security-YYYY-MM-DD.log` - 安全日志

---

如有问题，请查看日志文件或使用 `npm run cli status` 检查系统状态。