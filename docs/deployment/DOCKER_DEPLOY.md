# 🐳 Claude Relay Service - Docker 离线部署

## 📦 镜像导出（在有网络的环境）

### 1. 构建和导出镜像
```bash
# 构建镜像
docker build -t claude-relay-service:local .

# 导出镜像
docker save -o claude-relay-service.tar claude-relay-service:local

# 导出 Redis 镜像
docker pull redis:7-alpine
docker save -o redis-7-alpine.tar redis:7-alpine
```

### 2. 传输到目标服务器
```bash
# 使用 scp 传输镜像文件
scp claude-relay-service.tar user@target-server:/opt/data/2api/claude-relay-serviceV2/
scp redis-7-alpine.tar user@target-server:/opt/data/2api/claude-relay-serviceV2/
```

## 🚀 镜像导入和部署（在目标服务器）

### 1. 导入镜像
```bash
cd /opt/data/2api/claude-relay-serviceV2/

# 导入应用镜像
docker load -i claude-relay-service.tar

# 导入 Redis 镜像
docker load -i redis-7-alpine.tar

# 验证镜像
docker images | grep claude-relay-service
docker images | grep redis
```

### 2. 配置 Docker Compose
修改 `docker-compose.yml`：
```yaml
version: '3.8'

services:
  claude-relay:
    image: claude-relay-service:local  # 使用本地镜像
    restart: unless-stopped
    ports:
      - "13006:3000"
    volumes:
      - ./logs:/app/logs
      - ./data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HOST=0.0.0.0
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    depends_on:
      - redis
    networks:
      - claude-relay-network

  redis:
    image: redis:7-alpine  # 使用本地镜像
    restart: unless-stopped
    expose:
      - "6379"
    volumes:
      - ./redis_data:/data
    networks:
      - claude-relay-network

networks:
  claude-relay-network:
    driver: bridge
```

### 3. 启动服务
```bash
# 启动服务
docker-compose up -d

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs claude-relay
```

## 🔧 管理命令

### 查看服务状态
```bash
docker-compose ps
docker-compose logs -f claude-relay
```

### 重启服务
```bash
docker-compose restart claude-relay
```

### 停止服务
```bash
docker-compose down
```

### 更新镜像
```bash
# 停止服务
docker-compose down

# 删除旧镜像
docker rmi claude-relay-service:local

# 导入新镜像
docker load -i claude-relay-service.tar

# 重新启动
docker-compose up -d
```

## 🌐 访问验证
```bash
# 健康检查
curl http://localhost:13006/health

# 检查管理界面
curl -I http://localhost:13006/admin-next/api-stats
```

## 🚨 故障排除

### 1. 镜像导入失败
```bash
# 检查镜像文件完整性
docker load -i claude-relay-service.tar --dry-run

# 检查磁盘空间
df -h
```

### 2. 端口冲突
```bash
# 检查端口占用
netstat -tlnp | grep :13006

# 修改 docker-compose.yml 中的端口映射
ports:
  - "其他端口:3000"
```

### 3. 权限问题
```bash
# 确保目录权限正确
mkdir -p logs data redis_data
chmod 755 logs data redis_data
```