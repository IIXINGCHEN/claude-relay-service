# 🔒 Security Checklist - Before Committing to Git

**⚠️ CRITICAL: Always run this checklist before pushing code to any repository**

## 🚨 Never Commit These Files/Directories

### Absolutely Forbidden
- [ ] `.env` (contains real secrets)
- [ ] `.env.local`, `.env.*.local`
- [ ] `data/` directory (contains user data, credentials)
- [ ] `data/init.json` (contains admin password)
- [ ] `redis_data/` directory (contains all application data)
- [ ] `config/config.js` (may contain customized secrets)
- [ ] `logs/` directory (may contain sensitive request data)
- [ ] Any `*.backup`, `*.bak` files

### Safe to Commit (Templates Only)
- [x] `.env.example` (template with placeholder values)
- [x] `.env.docker.example` (template for Docker)
- [x] `config/config.example.js` (template)
- [x] `data/.gitkeep` (empty placeholder)
- [x] `data/README.md` (documentation only)

## 🔍 What to Check Before Every Commit

### 1. Environment Variables
```bash
# Check if .env is accidentally staged
git status | grep ".env"

# Should show ONLY:
# .env.example
# .env.docker.example
```

### 2. Configuration Files
```bash
# Check for config.js in staging
git diff --cached | grep "config/config.js"

# Should return NOTHING
```

### 3. Data Directory
```bash
# Check if data/ is staged (should only be .gitkeep)
git status | grep "data/"

# Should show ONLY:
# data/.gitkeep
# data/README.md
```

### 4. Scan for Hardcoded Secrets
```bash
# Run the automated security scanner
./scripts/check-secrets.sh

# Should pass with ✅ 
```

### 5. Check Git Diff for Sensitive Patterns
```bash
# Look for potential secrets in staged changes
git diff --cached | grep -iE "(password|secret|key|token|api[-_]?key)"

# Review ANY matches carefully!
```

## 📋 Common Sensitive Patterns to Avoid

### ❌ Never Hardcode
- Passwords: `password="MyP@ssw0rd"`
- API Keys: `API_KEY="sk-abcd1234..."`
- JWT Secrets: `JWT_SECRET="a1b2c3d4..."`
- Database URLs: `mongodb://username:password@host`
- Private IP addresses: `192.168.1.100` (use placeholders)
- Email addresses: `user@domain.com` (use examples)
- Real usernames: `iixingchen` (use placeholders)

### ✅ Use Instead
- Environment variables: `process.env.PASSWORD`
- Placeholders: `YOUR_PASSWORD_HERE`
- Examples: `example@example.com`
- Generics: `YOUR_SERVER_IP`, `YOUR_USERNAME`

## 🛡️ Automated Protection

### Setup Pre-commit Hook
```bash
# Make the hook executable
chmod +x .git-hooks/pre-commit
chmod +x scripts/check-secrets.sh

# Install the hook
ln -sf ../../.git-hooks/pre-commit .git/hooks/pre-commit

# Or on Windows:
mklink .git\hooks\pre-commit ..\..\. git-hooks\pre-commit
```

### Run Manual Check
```bash
# Before committing
./scripts/check-secrets.sh

# If any issues found, fix them before proceeding
```

## 🚑 Emergency: Secrets Already Committed

If you accidentally committed secrets:

### 1. Immediate Actions (Before Pushing)
```bash
# Amend the last commit (if not pushed yet)
git reset --soft HEAD~1

# Remove the sensitive file
git rm --cached path/to/sensitive/file

# Update .gitignore
echo "path/to/sensitive/file" >> .gitignore

# Commit again
git add .gitignore
git commit -m "fix: Remove sensitive data"
```

### 2. If Already Pushed
```bash
# ⚠️ This rewrites history - coordinate with team!

# Remove file from history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch path/to/sensitive/file' \
  --prune-empty --tag-name-filter cat -- --all

# Or use BFG Repo-Cleaner (recommended)
# https://rtyley.github.io/bfg-repo-cleaner/

# Force push (DANGEROUS - warn team first!)
git push origin --force --all
```

### 3. Rotate All Exposed Secrets
- [ ] Change all passwords
- [ ] Regenerate all API keys
- [ ] Rotate JWT secrets
- [ ] Update all services with new credentials
- [ ] Notify security team if applicable

## 📚 Additional Security Measures

### File Encryption (Optional)
For highly sensitive config files:
```bash
# Encrypt before committing
openssl enc -aes-256-cbc -salt -in secret.txt -out secret.txt.enc

# Commit only the encrypted version
git add secret.txt.enc
git commit -m "Add encrypted config"

# Decrypt when needed
openssl enc -aes-256-cbc -d -in secret.txt.enc -out secret.txt
```

### Git-crypt (Advanced)
For automatic encryption:
```bash
# Install git-crypt
# Ubuntu: sudo apt install git-crypt
# macOS: brew install git-crypt

# Initialize in repository
git-crypt init

# Configure .gitattributes for auto-encryption
echo "*.env filter=git-crypt diff=git-crypt" >> .gitattributes
echo "config/config.js filter=git-crypt diff=git-crypt" >> .gitattributes
```

## ✅ Final Checklist Before Push

- [ ] Ran `./scripts/check-secrets.sh` - passed
- [ ] Reviewed `git status` - no sensitive files
- [ ] Checked `git diff --cached` - no secrets in code
- [ ] Verified `.gitignore` is up to date
- [ ] All secrets are in environment variables
- [ ] No hardcoded IPs, usernames, or passwords
- [ ] Documentation uses placeholder values
- [ ] Pre-commit hook is installed and working

## 🎓 Training Resources

- [GitHub: Removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)
- [OWASP: Credential Management](https://cheatsheetseries.owasp.org/cheatsheets/Credential_Storage_Cheat_Sheet.html)
- [12-Factor App: Config](https://12factor.net/config)

---

**Remember**: It's easier to prevent leaks than to clean them up!

When in doubt, ask for review before pushing.
