# 安全配置指南

## Redis TLS 配置

系统检测到您尚未启用 Redis TLS 加密传输。虽然这在开发环境中是可以接受的，但在生产环境中建议启用 TLS 以增强安全性。

### 如何启用 Redis TLS

1. **配置 Redis 服务器支持 TLS**
   
   首先，确保您的 Redis 服务器已配置为支持 TLS 连接。在 Redis 配置文件（redis.conf）中添加：
   
   ```conf
   # 启用 TLS 端口
   tls-port 6380
   port 0  # 禁用非 TLS 端口（可选）
   
   # 配置证书
   tls-cert-file /path/to/redis.crt
   tls-key-file /path/to/redis.key
   tls-ca-cert-file /path/to/ca.crt
   
   # TLS 配置选项
   tls-dh-params-file /path/to/dhparam.pem
   tls-protocols "TLSv1.2 TLSv1.3"
   tls-ciphers "HIGH:!aNULL:!MD5"
   tls-ciphersuites "TLS_AES_256_GCM_SHA384:TLS_AES_128_GCM_SHA256"
   ```

2. **在 .env 文件中启用 TLS**
   
   ```env
   # Redis TLS 配置
   REDIS_ENABLE_TLS=true
   REDIS_PORT=6380  # 使用 TLS 端口
   
   # 如果使用自签名证书（仅开发环境）
   REDIS_TLS_REJECT_UNAUTHORIZED=false
   
   # 生产环境证书配置（可选）
   # REDIS_TLS_CA=/path/to/ca.crt
   # REDIS_TLS_CERT=/path/to/client.crt
   # REDIS_TLS_KEY=/path/to/client.key
   ```

3. **使用 Docker Compose 配置 TLS**
   
   如果使用 Docker Compose，可以这样配置：
   
   ```yaml
   services:
     redis:
       image: redis:7-alpine
       command: >
         redis-server
         --tls-port 6380
         --port 0
         --tls-cert-file /tls/redis.crt
         --tls-key-file /tls/redis.key
         --tls-ca-cert-file /tls/ca.crt
         --tls-auth-clients optional
       volumes:
         - ./tls:/tls:ro
       ports:
         - "6380:6380"
   ```

### 生成自签名证书（仅用于开发/测试）

```bash
# 生成 CA 私钥
openssl genrsa -out ca.key 4096

# 生成 CA 证书
openssl req -x509 -new -nodes -key ca.key -sha256 -days 365 -out ca.crt \
  -subj "/C=CN/ST=State/L=City/O=Organization/CN=Redis-CA"

# 生成服务器私钥
openssl genrsa -out redis.key 2048

# 生成证书签名请求
openssl req -new -key redis.key -out redis.csr \
  -subj "/C=CN/ST=State/L=City/O=Organization/CN=redis-server"

# 使用 CA 签署服务器证书
openssl x509 -req -in redis.csr -CA ca.crt -CAkey ca.key \
  -CAcreateserial -out redis.crt -days 365 -sha256
```

### 为什么不强制要求 Redis TLS？

1. **本地开发环境**: 在本地开发时，Redis 通常运行在 localhost，不需要 TLS
2. **内网部署**: 如果 Redis 和应用在同一私有网络内，TLS 可能不是必需的
3. **性能考虑**: TLS 会带来一定的性能开销（约 10-20%）
4. **配置复杂性**: 证书管理增加了运维复杂度

### 安全建议优先级

| 警告类型 | 优先级 | 场景 | 建议 |
|---------|--------|------|------|
| JWT_SECRET 默认值 | 🔴 严重 | 所有环境 | 必须更改 |
| ENCRYPTION_KEY 默认值 | 🔴 严重 | 所有环境 | 必须更改 |
| REDIS_PASSWORD 未设置 | 🟠 高 | 生产环境 | 强烈建议设置 |
| REDIS_TLS 未启用 | 🟡 中 | 生产环境 | 建议启用 |
| SESSION_SECRET 默认值 | 🟠 高 | 生产环境 | 建议更改 |

### 如何消除 Redis TLS 警告

如果您确定不需要 Redis TLS（例如在安全的内网环境），可以：

1. **方法一：设置环境变量表明知晓风险**
   ```env
   REDIS_TLS_NOT_REQUIRED=true  # 明确表示不需要 TLS
   ```

2. **方法二：修改安全检查器**
   编辑 `src/utils/securityChecker.js`，在 `checkRedisConfig` 方法中添加条件：
   ```javascript
   // 生产环境建议启用 TLS（除非明确表示不需要）
   if (
     process.env.NODE_ENV === 'production' && 
     !enableTLS && 
     process.env.REDIS_TLS_NOT_REQUIRED !== 'true'
   ) {
     this.warnings.push({
       type: 'REDIS_TLS',
       message: '生产环境建议启用 REDIS_ENABLE_TLS 进行加密传输',
       severity: 'MEDIUM'
     })
   }
   ```

## 其他安全配置

### 1. 必须配置的项目（生产环境）

```env
# 生成强密钥
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")

# 设置 Redis 密码
REDIS_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(16).toString('base64'))")

# 设置管理员凭据（可选，不设置会自动生成）
ADMIN_USERNAME=your_admin_name
ADMIN_PASSWORD=YourVeryStrongPassword123!@#
```

### 2. 网络安全

```env
# 限制监听地址（不要使用 0.0.0.0）
HOST=127.0.0.1  # 仅本机访问
# 或
HOST=10.0.0.5   # 指定内网 IP

# 启用 HTTPS（使用反向代理）
TRUST_PROXY=true
```

### 3. 限流和防护

```env
# 请求限制
REQUEST_TIMEOUT=60000  # 60秒超时
MAX_REQUEST_SIZE=10mb  # 最大请求大小

# 速率限制
RATE_LIMIT_WINDOW=60000  # 窗口大小（毫秒）
RATE_LIMIT_MAX=100      # 每个窗口最大请求数

# Claude 过载处理
CLAUDE_OVERLOAD_HANDLING_MINUTES=5  # 529错误后暂停账户时间
```

### 4. 监控和日志

```env
# 日志级别（生产环境建议 info 或 warn）
LOG_LEVEL=info

# 禁用调试模式
DEBUG=false
DEBUG_HTTP_TRAFFIC=false  # 绝不在生产环境启用

# 日志轮转
LOG_MAX_SIZE=10m
LOG_MAX_FILES=5
```

## 安全检查清单

- [ ] 更改所有默认密钥和密码
- [ ] 配置 Redis 密码
- [ ] 限制服务监听地址
- [ ] 配置反向代理（Nginx/Caddy）
- [ ] 启用 HTTPS
- [ ] 设置适当的超时和限制
- [ ] 配置日志轮转
- [ ] 定期更新依赖
- [ ] 备份加密密钥
- [ ] 监控异常登录尝试
- [ ] 设置防火墙规则
- [ ] 考虑启用 Redis TLS（如果适用）

## 问题排查

### 如何验证安全配置

运行应用时查看启动日志：

```bash
npm start
```

查看安全检查结果：
- ✅ 绿色勾号表示通过
- ⚠️ 黄色警告表示建议项
- ❌ 红色错误表示必须修复

### 常见问题

1. **"JWT_SECRET 使用默认值"错误**
   - 必须在 .env 文件中设置一个强随机密钥
   
2. **"ENCRYPTION_KEY 长度错误"**
   - 确保密钥正好是 32 个字符（16 字节的十六进制）
   
3. **"Redis 连接失败"**
   - 检查 Redis 服务是否运行
   - 验证 REDIS_HOST 和 REDIS_PORT 配置
   - 如果设置了密码，确保 REDIS_PASSWORD 正确

## 联系支持

如有安全相关问题，请通过私密渠道联系管理员，不要在公开场合讨论安全漏洞。
