# 🔒 安全须知 - 提交代码前必读

## ⚠️ 极其重要！

**在提交任何代码到 Git 仓库之前，请务必阅读并遵守以下安全规则！**

---

## 🚨 绝对禁止提交的内容

### 1. 敏感数据目录
- ❌ `data/` - 包含用户数据、凭据
- ❌ `redis_data/` - 包含所有应用数据
- ❌ `logs/` - 可能包含敏感日志

### 2. 配置文件（包含真实值）
- ❌ `.env` - 真实环境变量
- ❌ `.env.local`, `.env.production`
- ❌ `config/config.js` - 真实配置

### 3. 备份文件
- ❌ `*.backup`, `*.bak`
- ❌ `*.env.backup`

---

## ✅ 安全提交三步走

### 步骤 1: 运行安全扫描
```bash
./scripts/check-secrets.sh
```

### 步骤 2: 检查暂存区
```bash
git status
# 确保没有 data/, redis_data/, .env 等敏感文件
```

### 步骤 3: 审查变更
```bash
git diff --cached
# 仔细检查是否有敏感信息
```

---

## 🛡️ 自动保护措施

### 安装 Pre-commit Hook（推荐）

```bash
# Linux/macOS
chmod +x .git-hooks/pre-commit scripts/check-secrets.sh
ln -sf ../../.git-hooks/pre-commit .git/hooks/pre-commit

# Windows（PowerShell管理员权限）
New-Item -ItemType SymbolicLink -Path .git\hooks\pre-commit -Target ..\..\. git-hooks\pre-commit
```

安装后，每次 commit 都会自动扫描敏感信息。

---

## 📚 完整文档

详细的安全指南请查看：

1. **[SECURITY_CHECKLIST.md](./SECURITY_CHECKLIST.md)** - 完整检查清单
2. **[SECURITY_AUDIT.md](./SECURITY_AUDIT.md)** - 安全审计报告
3. **[data/README.md](./data/README.md)** - 数据目录说明

---

## 🚑 紧急情况处理

### 如果不小心提交了敏感信息

**还未 push：**
```bash
git reset --soft HEAD~1
git rm --cached 敏感文件
echo "敏感文件" >> .gitignore
git commit -m "fix: Remove sensitive data"
```

**已经 push：**
1. 立即轮换所有暴露的密钥
2. 联系仓库管理员
3. 按照 SECURITY_AUDIT.md 中的紧急响应计划操作

---

## ✅ 快速检查清单

提交前确认：
- [ ] 运行了 `./scripts/check-secrets.sh`
- [ ] 没有 `.env` 文件在暂存区
- [ ] 没有 `data/` 目录在暂存区
- [ ] 没有 `redis_data/` 目录在暂存区
- [ ] 代码中没有硬编码的密码、API密钥
- [ ] 文档中使用的是占位符，不是真实值

---

## 💡 重要提示

1. **`.env.example`** 可以提交 - 它只包含模板
2. **`data/.gitkeep`** 可以提交 - 它是空占位符
3. **`config/config.example.js`** 可以提交 - 它是模板

但这些**绝对不行**：
- `.env`（包含真实密钥）
- `data/init.json`（包含管理员密码）
- `redis_data/`（包含所有运行数据）

---

## 🔑 记住

**当你不确定时，问自己：**
- 这个文件包含密码吗？ → 不要提交
- 这个文件包含API密钥吗？ → 不要提交
- 这个文件包含用户数据吗？ → 不要提交
- 这个文件包含真实IP地址吗？ → 使用占位符

**安全第一！**

---

*创建日期: 2025-10-23*
