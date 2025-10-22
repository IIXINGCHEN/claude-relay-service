# 🚀 快速修复指南

## 立即执行（5分钟内完成）

### 1. 生成安全密钥

```bash
# 生成 JWT Secret (32字节 base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# 生成 Encryption Key (16字节 hex = 32字符)
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"

# 生成 Redis Password (16字节 base64)
node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"
```

### 2. 更新 .env 文件

```bash
# 编辑 .env 文件
nano .env

# 更新以下配置（使用上面生成的值）
JWT_SECRET=<生成的_JWT_Secret>
ENCRYPTION_KEY=<生成的_32字符_Hex>
REDIS_PASSWORD=<生成的_Redis_Password>
NODE_ENV=production
DEBUG_HTTP_TRAFFIC=false
```

### 3. 重启服务

```bash
# Docker 方式
docker-compose down
docker-compose up -d

# 或者 npm 方式
npm run service:restart:daemon
```

### 4. 验证修复

```bash
# 检查服务状态
curl http://localhost:3000/health

# 检查 Redis 密码是否生效
docker exec -it <redis_container_name> redis-cli -a <your_redis_password> ping
# 应该返回 PONG

# 检查日志脱敏
tail -f logs/claude-relay-*.log
# 不应该看到完整的 API Keys 或 tokens
```

---

## 完整部署（30分钟）

### 步骤 1: 备份现有数据

```bash
# 备份 Redis 数据
npm run data:export

# 备份现有配置
cp .env .env.backup
cp data/init.json data/init.json.backup
```

### 步骤 2: 更新代码

```bash
# 拉取最新代码
git pull origin main

# 安装依赖（如果有更新）
npm install

# 构建前端（如果有更新）
cd web/admin-spa && npm install && npm run build && cd ../..
```

### 步骤 3: 配置安全设置

1. **生成所有密钥**（见上面第1步）

2. **更新 .env 文件**（见上面第2步）

3. **检查配置文件**:
```bash
# 运行安全检查
npm run setup
```

### 步骤 4: 重启并验证

```bash
# 重启服务
docker-compose down
docker-compose up -d

# 等待服务启动
sleep 10

# 验证健康状态
curl http://localhost:3000/health | jq

# 检查日志
docker-compose logs -f --tail=50
```

### 步骤 5: 功能测试

```bash
# 测试 API Key 认证
curl -X GET http://localhost:3000/api/v1/key-info \
  -H "x-api-key: <your_test_key>"

# 测试管理后台
# 浏览器访问: http://localhost:3000/admin-next/

# 测试日志脱敏（开发环境）
# 临时启用 DEBUG 模式，发送测试请求，查看日志是否脱敏
```

---

## 问题排查

### 问题 1: Redis 连接失败

**症状**: `ECONNREFUSED` 或 `Authentication failed`

**解决方案**:
```bash
# 检查 Redis 容器状态
docker-compose ps redis

# 检查 Redis 日志
docker-compose logs redis

# 验证密码配置
docker exec -it <redis_container> redis-cli -a <your_password> ping

# 如果密码错误，更新 .env 并重启
docker-compose restart redis
docker-compose restart claude-relay
```

### 问题 2: 日志没有脱敏

**症状**: 日志中仍然可以看到完整的 API Keys

**解决方案**:
```bash
# 检查 sensitiveDataMasker.js 是否存在
ls -la src/utils/sensitiveDataMasker.js

# 重启服务以加载新代码
docker-compose restart claude-relay

# 查看启动日志确认模块加载
docker-compose logs claude-relay | grep -i "sensitive"
```

### 问题 3: 费用计算告警未收到

**症状**: 费用计算失败但没有收到 Webhook 通知

**解决方案**:
```bash
# 检查 WEBHOOK_ENABLED 配置
grep WEBHOOK_ENABLED .env

# 检查 WEBHOOK_URLS 配置
grep WEBHOOK_URLS .env

# 查看 webhook 日志
tail -f logs/webhook-*.log

# 测试 webhook 连接
curl -X POST <your_webhook_url> \
  -H "Content-Type: application/json" \
  -d '{"test": "connection"}'
```

### 问题 4: Docker 构建慢或失败

**症状**: `docker-compose build` 非常慢或出错

**解决方案**:
```bash
# 检查 .dockerignore 是否存在
ls -la .dockerignore

# 清理 Docker 缓存
docker system prune -a

# 重新构建
docker-compose build --no-cache
docker-compose up -d
```

---

## 监控建议

### 设置告警

1. **Redis 内存使用**:
```bash
# 添加到监控脚本
watch -n 60 'docker stats --no-stream | grep redis'
```

2. **日志文件大小**:
```bash
# 定期检查
du -sh logs/
```

3. **并发连接数**:
```bash
# 查看当前连接
docker exec <redis_container> redis-cli -a <password> client list | wc -l
```

### 定期维护

```bash
# 每周任务
# 1. 检查日志大小
du -sh logs/

# 2. 清理过期日志
find logs/ -name "*.log.*" -mtime +30 -delete

# 3. 备份数据
npm run data:export

# 4. 检查 Redis 内存
docker exec <redis_container> redis-cli -a <password> INFO memory
```

---

## 回滚方案

如果修复后出现问题，可以快速回滚：

```bash
# 步骤 1: 停止服务
docker-compose down

# 步骤 2: 恢复配置
cp .env.backup .env
cp data/init.json.backup data/init.json

# 步骤 3: 恢复代码（如果需要）
git reset --hard <previous_commit_hash>

# 步骤 4: 恢复数据（如果需要）
npm run data:import

# 步骤 5: 重启服务
docker-compose up -d
```

---

## 下一步优化（可选）

完成上述紧急修复后，可以考虑以下优化：

1. **添加测试** (优先级: 低)
   - 为核心服务添加单元测试
   - 添加 API 集成测试

2. **环境变量统一** (优先级: 中)
   - 统一通过 config 模块访问配置
   - 减少直接使用 `process.env`

3. **前端 XSS 防护** (优先级: 中)
   - 审查 Vue 模板，避免使用 `v-html`
   - 改进 CSP 策略

4. **并发监控** (优先级: 中)
   - 实现并发异常检测
   - 添加自动告警

详细信息请参考 `SECURITY_FIXES.md`。

---

## 支持联系

- 查看详细文档: `SECURITY_FIXES.md`
- 查看项目文档: `CLAUDE.md`
- 检查健康状态: `http://localhost:3000/health`
- 查看系统指标: `http://localhost:3000/metrics`
