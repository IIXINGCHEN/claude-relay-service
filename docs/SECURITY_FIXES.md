# 🔐 安全性修复指南

## 📅 创建日期
2025-10-22

## 🚨 需要立即修复的安全问题

### 1. 敏感信息泄露防护

#### 问题
- 错误响应中包含详细的内部错误信息
- 日志中可能包含未脱敏的敏感数据
- HTTP响应头可能暴露服务器信息

#### 修复方案

```javascript
// ✅ 修复1: 使用标准化错误响应
const { StandardResponses } = require('../utils/standardResponses')

// 替换所有直接的错误响应
// 之前：
res.status(500).json({ error: error.message })
// 之后：
StandardResponses.internalError(res, error)

// ✅ 修复2: 确保所有日志都经过脱敏
const sensitiveDataMasker = require('../utils/sensitiveDataMasker')
logger.error('Error:', sensitiveDataMasker.maskObject(error))

// ✅ 修复3: 隐藏服务器信息
app.disable('x-powered-by')
app.use(helmet({
  hidePoweredBy: true,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    }
  }
}))
```

### 2. 速率限制加强

#### 当前问题
- 某些端点缺少速率限制
- 速率限制配置不一致
- 缺少分布式速率限制

#### 修复方案

```javascript
// ✅ 添加全局速率限制中间件
const { RateLimiterRedis } = require('rate-limiter-flexible')

const globalRateLimiter = new RateLimiterRedis({
  storeClient: redisClient,
  keyPrefix: 'global_limit',
  points: 100, // 请求次数
  duration: 60, // 时间窗口（秒）
  blockDuration: 60, // 封禁时间（秒）
})

// 应用到所有路由
app.use(async (req, res, next) => {
  try {
    await globalRateLimiter.consume(req.ip)
    next()
  } catch (rejRes) {
    StandardResponses.rateLimited(res, rejRes.msBeforeNext / 1000)
  }
})
```

### 3. 输入验证增强

#### 问题
- 不一致的输入验证
- 缺少某些字段的验证
- SQL注入风险（虽然使用Redis）

#### 修复方案

```javascript
// ✅ 使用统一的验证中间件
const { body, validationResult } = require('express-validator')

const validateRequest = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return StandardResponses.validationError(res, errors.array())
  }
  next()
}

// 应用验证规则
router.post('/messages',
  body('model').isString().trim().escape(),
  body('messages').isArray().notEmpty(),
  body('messages.*.content').isString().trim(),
  body('max_tokens').optional().isInt({ min: 1, max: 200000 }),
  validateRequest,
  async (req, res) => {
    // 处理请求
  }
)
```

### 4. 认证与授权加固

#### 问题
- JWT密钥强度不够
- 缺少令牌刷新机制
- 权限检查不够细粒度

#### 修复方案

```javascript
// ✅ 增强JWT验证
const jwt = require('jsonwebtoken')

// 使用更强的密钥
const JWT_SECRET = crypto.randomBytes(64).toString('hex')

// 添加更多声明验证
const verifyToken = (token) => {
  return jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: 'claude-relay-service',
    audience: 'api-client',
    clockTolerance: 30 // 30秒时钟偏差容忍
  })
}

// ✅ 实现细粒度权限检查
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user.permissions.includes(requiredPermission)) {
      return StandardResponses.forbidden(res, '权限不足')
    }
    next()
  }
}
```

### 5. 会话安全

#### 问题
- 会话固定攻击风险
- 缺少CSRF保护
- Cookie安全配置不足

#### 修复方案

```javascript
// ✅ 安全的会话配置
const session = require('express-session')
const RedisStore = require('connect-redis')(session)

app.use(session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true, // 活动时重置过期时间
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only
    httpOnly: true, // 防止XSS
    maxAge: 1000 * 60 * 60, // 1小时
    sameSite: 'strict' // CSRF防护
  }
}))

// ✅ CSRF保护
const csrf = require('csurf')
const csrfProtection = csrf({ cookie: true })
app.use(csrfProtection)
```

## 📊 安全配置清单

### 环境变量安全
```env
# ✅ 必须设置的安全变量
NODE_ENV=production
JWT_SECRET=<64字符随机字符串>
ENCRYPTION_KEY=<32字符十六进制>
SESSION_SECRET=<64字符随机字符串>
ADMIN_PASSWORD=<强密码，至少16字符>
REDIS_PASSWORD=<强密码>

# ✅ 安全相关配置
ENABLE_HTTPS=true
FORCE_HTTPS=true
TRUST_PROXY=true
RATE_LIMIT_ENABLED=true
AUDIT_LOG_ENABLED=true
```

### HTTP安全头
```javascript
// ✅ 完整的安全头配置
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "cross-origin" },
  dnsPrefetchControl: true,
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: false,
  referrerPolicy: { policy: "no-referrer" },
  xssFilter: true
}))
```

## 🔥 紧急修复优先级

### 今天必须完成
1. ✅ 替换所有不安全的错误响应
2. ✅ 添加全局速率限制
3. ✅ 确保所有日志经过脱敏

### 本周完成
1. ⏳ 实现CSRF保护
2. ⏳ 增强输入验证
3. ⏳ 升级会话安全

### 本月完成
1. ⏳ 实施安全审计日志
2. ⏳ 添加入侵检测
3. ⏳ 实现API密钥轮换

## 🧪 安全测试检查表

- [ ] 所有错误响应都不包含敏感信息
- [ ] 速率限制在所有端点生效
- [ ] 输入验证覆盖所有用户输入
- [ ] JWT令牌正确验证和过期
- [ ] 会话安全配置正确
- [ ] HTTP安全头都已设置
- [ ] 日志不包含敏感数据
- [ ] HTTPS强制启用
- [ ] CORS配置正确
- [ ] 文件上传有大小和类型限制

## 📚 参考资源

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [Helmet.js Documentation](https://helmetjs.github.io/)
