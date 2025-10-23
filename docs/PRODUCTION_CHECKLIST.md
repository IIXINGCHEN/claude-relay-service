# 🚀 生产环境部署检查清单

在将 Claude Relay Service 部署到生产环境前，请确保完成以下检查项。

## ✅ 安全配置（必须）

### 1. 密钥和认证
- [ ] **JWT_SECRET**: 已设置为至少32字符的强随机密钥
- [ ] **ENCRYPTION_KEY**: 已设置为32字符的强随机密钥
- [ ] **WEB_SESSION_SECRET**: 已设置为强随机密钥
- [ ] **管理员密码**: 已修改默认管理员密码为强密码（12+字符）
- [ ] **API Keys**: 已创建生产环境专用的 API Keys

```bash
# 生成安全密钥
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(16).toString('hex'))"
node -e "console.log('WEB_SESSION_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
```

### 2. Redis 安全
- [ ] **REDIS_PASSWORD**: 已设置强密码
- [ ] **REDIS_ENABLE_TLS**: 生产环境建议启用 TLS 加密
- [ ] **Redis 访问控制**: 已配置防火墙规则，限制 Redis 访问

### 3. 环境变量
- [ ] **NODE_ENV**: 已设置为 `production`
- [ ] **LOG_LEVEL**: 已设置为 `info` 或 `warn`（避免 debug）
- [ ] **DEBUG_HTTP_TRAFFIC**: 已关闭（不设置或设置为 false）
- [ ] **.env 文件权限**: 已设置为 600 或 400

```bash
chmod 600 .env
```

## ⚙️ 系统配置（必须）

### 1. 服务器配置
- [ ] **端口配置**: PORT 已设置为正确的端口（建议使用反向代理）
- [ ] **HOST 配置**: 已正确设置（0.0.0.0 或具体 IP）
- [ ] **超时设置**: REQUEST_TIMEOUT 已根据实际需求调整

### 2. 反向代理（推荐）
- [ ] **Nginx/Caddy**: 已配置反向代理
- [ ] **HTTPS**: 已配置 SSL/TLS 证书
- [ ] **请求大小限制**: 已设置合适的 client_max_body_size
- [ ] **超时配置**: 已设置合适的 proxy_timeout

Nginx 配置示例：
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    client_max_body_size 100M;
    proxy_read_timeout 600s;
    
    # 允许下划线在请求头中（粘性会话需要）
    underscores_in_headers on;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. 数据库和存储
- [ ] **Redis 持久化**: 已启用 RDB 或 AOF 持久化
- [ ] **备份策略**: 已配置自动备份计划
- [ ] **日志轮转**: 已配置日志文件轮转和归档

## 🔍 验证和测试（必须）

### 1. 运行验证脚本
```bash
# 验证环境变量
npm run validate:env

# 验证安全配置
npm run lint

# 运行测试
npm test
```

### 2. 手动测试
- [ ] **管理员登录**: 测试管理员界面登录
- [ ] **API Key 创建**: 创建和测试 API Key
- [ ] **账户添加**: 测试添加各类型账户（Claude/Gemini/Droid等）
- [ ] **API 转发**: 测试实际的 API 转发功能
- [ ] **日志记录**: 检查日志是否正常记录且无敏感信息泄露

### 3. 性能测试
- [ ] **负载测试**: 使用 Apache Bench 或 wrk 进行负载测试
- [ ] **内存监控**: 检查内存使用是否正常
- [ ] **Redis 连接**: 检查 Redis 连接池是否正常

```bash
# 简单负载测试
ab -n 100 -c 10 http://localhost:3000/health
```

## 📊 监控和日志（推荐）

### 1. 日志配置
- [ ] **日志级别**: 已设置为 info 或 warn
- [ ] **日志轮转**: 已配置 maxSize 和 maxFiles
- [ ] **日志目录权限**: 已设置正确的权限

### 2. 监控设置
- [ ] **健康检查**: 配置定时健康检查 `/health`
- [ ] **指标监控**: 配置监控 `/metrics` 端点
- [ ] **告警设置**: 配置关键指标告警（可选）

### 3. Webhook 通知
- [ ] **Webhook 配置**: 已配置 Webhook 通知 URL
- [ ] **通知测试**: 测试 Webhook 通知是否正常

## 🔧 可选优化

### 1. 性能优化
- [ ] **Redis 连接池**: 根据负载调整连接池大小
- [ ] **缓存配置**: 调整 LRU 缓存大小
- [ ] **并发限制**: 设置合适的并发限制

### 2. 功能配置
- [ ] **用户管理**: 决定是否启用 USER_MANAGEMENT_ENABLED
- [ ] **LDAP 认证**: 如需要，配置 LDAP 参数
- [ ] **粘性会话**: 配置合适的 TTL 和续期阈值
- [ ] **529 错误处理**: 配置 CLAUDE_OVERLOAD_HANDLING_MINUTES

### 3. 账户分组
- [ ] **账户分组**: 配置账户分组策略
- [ ] **优先级设置**: 为账户设置合适的优先级

## 🚦 部署前最终检查

### 执行自动检查
```bash
# 1. 验证环境配置
npm run validate:env

# 2. 运行代码检查
npm run lint

# 3. 运行测试
npm test

# 4. 构建（如需要）
npm run build:web
```

### 启动服务
```bash
# 开发环境测试
npm run dev

# 生产环境启动
npm start

# 或使用 PM2（推荐）
pm2 start ecosystem.config.js --env production
```

### 验证启动
- [ ] 查看启动日志，确认无错误
- [ ] 访问 `/health` 端点，确认服务健康
- [ ] 访问管理界面 `/admin-next/`，确认可正常访问
- [ ] 测试实际 API 调用，确认功能正常

## 📝 部署后检查

### 第一天
- [ ] 监控错误日志，及时处理异常
- [ ] 检查 API 响应时间和成功率
- [ ] 验证账户余额消耗是否正常
- [ ] 检查 Redis 内存使用情况

### 第一周
- [ ] 审查使用统计和成本数据
- [ ] 检查系统资源使用趋势
- [ ] 收集用户反馈
- [ ] 优化配置参数

## 🆘 应急预案

### 回滚计划
- [ ] **备份数据**: 部署前备份 Redis 数据
- [ ] **版本记录**: 记录当前部署版本
- [ ] **回滚步骤**: 准备快速回滚步骤

### 故障处理
- [ ] **日志位置**: 团队知晓日志文件位置
- [ ] **重启命令**: 准备服务重启命令
- [ ] **联系方式**: 准备技术支持联系方式

---

## ✅ 最终确认

**我确认已完成以上所有必需检查项，服务可以部署到生产环境。**

- 检查人: _______________
- 日期: _______________
- 签名: _______________
