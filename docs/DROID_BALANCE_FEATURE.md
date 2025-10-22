# Droid API Key 余额查询功能

## 功能概述

为Droid账户添加了实时余额查询功能，支持查看每个API Key的剩余额度，帮助用户及时了解账户使用情况。

## 功能特性

### 1. 后端服务（droidAccountService）

#### `checkApiKeyBalance(apiKey, proxyConfig)`
查询单个API Key的余额信息。

**参数：**
- `apiKey` (string): Factory.ai API Key
- `proxyConfig` (Object, 可选): 代理配置

**返回值：**
```javascript
{
  success: true,
  balance: 1000,           // 余额数值
  remaining: 1000,         // 剩余额度
  used: 0,                 // 已使用（如果API返回）
  limit: 10000,            // 总额度（如果API返回）
  raw: {...}               // 原始API响应
}
```

**错误响应：**
```javascript
{
  success: false,
  error: "error message",
  statusCode: 401,
  errorData: {...}
}
```

#### `checkAllApiKeysBalance(accountId)`
批量查询账户下所有API Keys的余额。

**参数：**
- `accountId` (string): Droid账户ID

**返回值：**
```javascript
[
  {
    id: "key-id-1",
    status: "active",
    usageCount: 10,
    lastUsedAt: "2025-01-20T12:00:00.000Z",
    balance: 1000,
    balanceRemaining: 1000,
    balanceError: null,
    balanceCheckedAt: "2025-01-20T14:00:00.000Z"
  },
  // ... 更多API Keys
]
```

### 2. 后端API路由

#### `GET /admin/droid-accounts/:id/balance`

查询Droid账户下所有API Keys的余额。

**权限：** 需要管理员认证

**请求示例：**
```bash
curl -X GET "http://localhost:3000/admin/droid-accounts/61a055fc-07e9-445f-9a8a-27f51ecaf882/balance" \
  -H "Authorization: Bearer admin-token"
```

**响应示例：**
```json
{
  "success": true,
  "accountId": "61a055fc-07e9-445f-9a8a-27f51ecaf882",
  "accountName": "My Droid Account",
  "balances": [
    {
      "id": "api-key-id-1",
      "status": "active",
      "usageCount": 10,
      "lastUsedAt": "2025-01-20T12:00:00.000Z",
      "balance": 1000,
      "balanceRemaining": 1000,
      "balanceError": null,
      "balanceCheckedAt": "2025-01-20T14:00:00.000Z"
    }
  ],
  "checkedAt": "2025-01-20T14:00:00.000Z"
}
```

### 3. Web前端界面

#### 余额显示位置
在账户列表的Droid账户卡片上，紧跟在API Key数量徽章后面。

#### 余额按钮样式
- **未查询状态**：显示"查余额"按钮（绿色徽章）
- **已查询状态**：显示总余额（如：1.5K, 2.3M）
- **hover提示**：显示每个API Key的详细余额

#### 使用方法
1. 在账户管理页面找到Droid账户
2. 点击"查余额"按钮
3. 系统会自动查询所有API Keys的余额
4. 结果会缓存在前端，点击可刷新

#### 余额格式化规则
- `0-999`: 显示完整数字（如：`123`）
- `1,000-999,999`: 显示K单位（如：`1.5K`）
- `1,000,000+`: 显示M单位（如：`2.3M`）

### 4. Factory.ai API 端点

余额查询使用 Factory.ai 的官方端点：

```
GET https://app.factory.ai/api/cli/credits
```

**请求头：**
```
Authorization: Bearer <api-key>
Content-Type: application/json
Accept: application/json
x-factory-client: cli
User-Agent: factory-cli/0.19.12
```

**可能的响应格式：**
```javascript
// 格式 1
{
  "credits": 1000,
  "used": 100,
  "limit": 10000
}

// 格式 2
{
  "balance": 1000,
  "remaining": 1000
}

// 格式 3
{
  "remaining": 1000
}
```

## 使用示例

### 1. 通过Web界面查询

1. 访问 `http://localhost:3000/admin-next/`
2. 登录管理员账户
3. 进入"账户管理"页面
4. 找到Droid账户（显示为蓝绿色徽章）
5. 点击"查余额"按钮
6. 等待查询完成（约1-3秒）
7. 查看显示的余额数值

### 2. 通过API查询

```javascript
const axios = require('axios')

const checkBalance = async () => {
  const response = await axios.get(
    'http://localhost:3000/admin/droid-accounts/61a055fc-07e9-445f-9a8a-27f51ecaf882/balance',
    {
      headers: {
        Authorization: 'Bearer admin-token'
      }
    }
  )

  console.log('Total Balance:', response.data.balances.reduce((sum, item) => 
    sum + (item.balance || 0), 0
  ))
}

checkBalance()
```

### 3. 通过测试脚本

```bash
node scripts/test-droid-balance.js
```

## 故障排查

### 1. 余额查询失败

**可能原因：**
- API Key无效或已过期
- 代理配置错误
- Factory.ai API限流
- 网络连接问题

**解决方法：**
1. 检查API Key是否有效
2. 验证代理配置
3. 查看日志 `logs/claude-relay-*.log`
4. 手动测试API Key：
   ```bash
   curl -X GET "https://app.factory.ai/api/cli/credits" \
     -H "Authorization: Bearer your-api-key"
   ```

### 2. 前端显示N/A

**可能原因：**
- 后端查询失败
- API Key处于error状态
- Factory.ai API返回格式不符合预期

**解决方法：**
1. 打开浏览器控制台查看错误信息
2. 检查后端日志
3. 重新查询余额

### 3. 查询速度慢

**可能原因：**
- 多个API Keys并发查询
- 代理延迟高
- Factory.ai API响应慢

**优化建议：**
- 减少API Key数量
- 使用更快的代理
- 适当增加timeout设置

## 技术细节

### 并发查询
使用 `Promise.all()` 并发查询所有API Keys的余额，提高查询效率。

### 缓存策略
前端缓存余额数据，避免频繁查询。刷新方法：点击余额按钮。

### 错误处理
- 单个API Key查询失败不影响其他Keys
- 自动标记异常状态的API Keys
- 详细的错误日志记录

### 代理支持
- 自动使用账户配置的代理
- 支持SOCKS5和HTTP代理
- 代理认证支持

## 未来增强

- [ ] 添加余额告警阈值设置
- [ ] 支持自动定时刷新余额
- [ ] 余额历史记录和趋势图
- [ ] 批量充值功能（如果Factory.ai支持）
- [ ] 余额不足时的Webhook通知

## 相关文件

- `src/services/droidAccountService.js` - 核心服务（余额查询逻辑）
- `src/routes/admin.js` - API路由（余额查询端点）
- `web/admin-spa/src/views/AccountsView.vue` - 前端界面
- `scripts/test-droid-balance.js` - 测试脚本
- `docs/DROID_BALANCE_FEATURE.md` - 功能文档（本文件）

## 更新日志

**2025-01-20:**
- ✅ 添加 `checkApiKeyBalance` 方法
- ✅ 添加 `checkAllApiKeysBalance` 方法
- ✅ 添加 GET `/admin/droid-accounts/:id/balance` API端点
- ✅ 前端添加余额显示按钮
- ✅ 前端添加余额格式化和tooltip
- ✅ 创建测试脚本
- ✅ 文档完善
