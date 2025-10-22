# 🔒 安全配置提示

您看到的 Redis TLS 警告是一个**建议**而非错误。

## 快速解决方案

### 选项 1：如果您不需要 Redis TLS（推荐用于本地开发）

在 `.env` 文件中添加：
```env
REDIS_TLS_NOT_REQUIRED=true
```

这会消除警告，明确表示您的环境不需要 TLS 加密。

### 选项 2：启用 Redis TLS（推荐用于生产环境）

请参考 `docs/SECURITY_CONFIGURATION.md` 了解详细配置步骤。

### 选项 3：使用配置助手

运行以下命令自动配置：
```bash
node scripts/configure-security.js
```

## 为什么会有这个警告？

- **本地开发**：如果 Redis 在 localhost 运行，TLS 不是必需的
- **安全内网**：如果应用和 Redis 在同一安全网络内，风险较低
- **生产环境**：如果 Redis 暴露在公网或不可信网络，强烈建议启用 TLS

## 其他安全注意事项

⚠️ **更重要的安全配置**：
1. `JWT_SECRET` - 必须更改默认值
2. `ENCRYPTION_KEY` - 必须设置为 32 字符
3. `REDIS_PASSWORD` - 强烈建议设置

这些配置比 Redis TLS 更加重要，请优先处理。

---

💡 **提示**：此警告不影响服务正常运行，您可以根据实际需求决定是否启用 TLS。
