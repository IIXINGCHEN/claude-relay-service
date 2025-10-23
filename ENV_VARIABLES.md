# 🔧 Environment Variables Guide

Complete reference for all environment variables used in Claude Relay Service.

**⚠️ CRITICAL**: All configuration should be done through environment variables in `.env` file, NOT hardcoded in code.

---

## 📋 Table of Contents

- [Required Variables](#required-variables)
- [Server Configuration](#server-configuration)
- [Security Configuration](#security-configuration)
- [Redis Configuration](#redis-configuration)
- [Claude API Configuration](#claude-api-configuration)
- [Proxy Configuration](#proxy-configuration)
- [Logging Configuration](#logging-configuration)
- [System Configuration](#system-configuration)
- [Web Interface Configuration](#web-interface-configuration)
- [LDAP Authentication](#ldap-authentication)
- [User Management](#user-management)
- [Advanced Configuration](#advanced-configuration)

---

## 🔴 Required Variables

These variables **MUST** be set before starting the application.

### JWT_SECRET

**Description**: Secret key for signing JWT tokens.

**Type**: String  
**Required**: ✅ YES  
**Default**: None (must be set)  
**Min Length**: 32 characters  

**Generate**:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

**Example**:
```env
JWT_SECRET=a1b2c3d4e5f6...your-long-random-string
```

### ENCRYPTION_KEY

**Description**: Key for encrypting sensitive data in Redis.

**Type**: String  
**Required**: ✅ YES  
**Default**: None (must be set)  
**Length**: Exactly 32 characters  

**Generate**:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

**Example**:
```env
ENCRYPTION_KEY=0123456789abcdef0123456789abcdef
```

---

## 🌐 Server Configuration

### PORT

**Description**: Port number for the HTTP server.

**Type**: Integer  
**Required**: No  
**Default**: `3000`  
**Range**: 1-65535  

**Example**:
```env
PORT=3000
```

### HOST

**Description**: Host address to bind the server.

**Type**: String  
**Required**: No  
**Default**: `0.0.0.0` (all interfaces)  

**Example**:
```env
HOST=0.0.0.0
```

### NODE_ENV

**Description**: Application environment mode.

**Type**: String  
**Required**: No  
**Default**: `development`  
**Values**: `development`, `production`, `test`  

**Example**:
```env
NODE_ENV=production
```

### TRUST_PROXY

**Description**: Trust proxy headers (X-Forwarded-*).

**Type**: Boolean  
**Required**: No  
**Default**: `false`  
**Values**: `true`, `false`  

**Example**:
```env
TRUST_PROXY=true
```

---

## 🔐 Security Configuration

### ADMIN_SESSION_TIMEOUT

**Description**: Admin session timeout in milliseconds.

**Type**: Integer  
**Required**: No  
**Default**: `86400000` (24 hours)  

**Example**:
```env
ADMIN_SESSION_TIMEOUT=86400000
```

### API_KEY_PREFIX

**Description**: Prefix for generated API keys.

**Type**: String  
**Required**: No  
**Default**: `cr_`  

**Example**:
```env
API_KEY_PREFIX=cr_
```

### ADMIN_USERNAME

**Description**: Admin username (optional, auto-generated if not set).

**Type**: String  
**Required**: No  
**Default**: Auto-generated  

**Example**:
```env
ADMIN_USERNAME=admin
```

### ADMIN_PASSWORD

**Description**: Admin password (optional, auto-generated if not set).

**Type**: String  
**Required**: No  
**Default**: Auto-generated  
**Min Length**: 12 characters recommended  

**Example**:
```env
ADMIN_PASSWORD=YourSecurePassword123!
```

### WEB_SESSION_SECRET

**Description**: Secret for web session encryption.

**Type**: String  
**Required**: Recommended  
**Default**: Fallback secret (not secure)  
**Min Length**: 16 characters  

**Generate**:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Example**:
```env
WEB_SESSION_SECRET=your-random-session-secret-here
```

---

## 📊 Redis Configuration

### REDIS_HOST

**Description**: Redis server hostname or IP address.

**Type**: String  
**Required**: No  
**Default**: `127.0.0.1`  

**Example**:
```env
REDIS_HOST=localhost
```

### REDIS_PORT

**Description**: Redis server port.

**Type**: Integer  
**Required**: No  
**Default**: `6379`  

**Example**:
```env
REDIS_PORT=6379
```

### REDIS_PASSWORD

**Description**: Redis authentication password.

**Type**: String  
**Required**: No (but recommended for production)  
**Default**: Empty (no password)  

**Example**:
```env
REDIS_PASSWORD=your-redis-password
```

### REDIS_DB

**Description**: Redis database number.

**Type**: Integer  
**Required**: No  
**Default**: `0`  
**Range**: 0-15 (typically)  

**Example**:
```env
REDIS_DB=0
```

### REDIS_ENABLE_TLS

**Description**: Enable TLS/SSL for Redis connection.

**Type**: Boolean  
**Required**: No  
**Default**: `false`  
**Values**: `true`, `false`  

**Example**:
```env
REDIS_ENABLE_TLS=true
```

---

## 🎯 Claude API Configuration

### CLAUDE_API_URL

**Description**: Claude API endpoint URL.

**Type**: String  
**Required**: No  
**Default**: `https://api.anthropic.com/v1/messages`  

**Example**:
```env
CLAUDE_API_URL=https://api.anthropic.com/v1/messages
```

### CLAUDE_API_VERSION

**Description**: Claude API version header.

**Type**: String  
**Required**: No  
**Default**: `2023-06-01`  

**Example**:
```env
CLAUDE_API_VERSION=2023-06-01
```

### CLAUDE_BETA_HEADER

**Description**: Beta features to enable.

**Type**: String (comma-separated)  
**Required**: No  
**Default**: `claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,fine-grained-tool-streaming-2025-05-14`  

**Example**:
```env
CLAUDE_BETA_HEADER=claude-code-20250219,oauth-2025-04-20
```

### CLAUDE_OVERLOAD_HANDLING_MINUTES

**Description**: Duration to handle 529 overload errors (0 to disable).

**Type**: Integer  
**Required**: No  
**Default**: `0` (disabled)  
**Range**: 0-1440 (24 hours max)  

**Example**:
```env
CLAUDE_OVERLOAD_HANDLING_MINUTES=5
```

### CLAUDE_CONSOLE_BLOCKED_HANDLING_MINUTES

**Description**: Duration to handle 400 blocked account errors (0 to disable).

**Type**: Integer  
**Required**: No  
**Default**: `10`  

**Example**:
```env
CLAUDE_CONSOLE_BLOCKED_HANDLING_MINUTES=10
```

---

## 🌐 Proxy Configuration

### DEFAULT_PROXY_TIMEOUT

**Description**: Default proxy request timeout in milliseconds.

**Type**: Integer  
**Required**: No  
**Default**: `600000` (10 minutes)  

**Example**:
```env
DEFAULT_PROXY_TIMEOUT=600000
```

### MAX_PROXY_RETRIES

**Description**: Maximum number of proxy request retries.

**Type**: Integer  
**Required**: No  
**Default**: `3`  

**Example**:
```env
MAX_PROXY_RETRIES=3
```

### PROXY_USE_IPV4

**Description**: Use IPv4 for proxy connections.

**Type**: Boolean  
**Required**: No  
**Default**: `true`  
**Values**: `true` (IPv4), `false` (IPv6)  

**Example**:
```env
PROXY_USE_IPV4=true
```

### REQUEST_TIMEOUT

**Description**: General request timeout in milliseconds.

**Type**: Integer  
**Required**: No  
**Default**: `600000` (10 minutes)  

**Example**:
```env
REQUEST_TIMEOUT=600000
```

---

## 📝 Logging Configuration

### LOG_LEVEL

**Description**: Logging level.

**Type**: String  
**Required**: No  
**Default**: `info`  
**Values**: `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`  

**Example**:
```env
LOG_LEVEL=info
```

### LOG_MAX_SIZE

**Description**: Maximum log file size before rotation.

**Type**: String  
**Required**: No  
**Default**: `10m`  

**Example**:
```env
LOG_MAX_SIZE=20m
```

### LOG_MAX_FILES

**Description**: Maximum number of log files to keep.

**Type**: Integer  
**Required**: No  
**Default**: `5`  

**Example**:
```env
LOG_MAX_FILES=10
```

### DEBUG

**Description**: Enable debug mode.

**Type**: Boolean  
**Required**: No  
**Default**: `false`  
**Values**: `true`, `false`  

**Example**:
```env
DEBUG=false
```

### DEBUG_HTTP_TRAFFIC

**Description**: Enable HTTP request/response debug logging.

**Type**: Boolean  
**Required**: No  
**Default**: `false`  
**Values**: `true`, `false`  

**Example**:
```env
DEBUG_HTTP_TRAFFIC=false
```

---

## 🔧 System Configuration

### CLEANUP_INTERVAL

**Description**: Interval for cleanup tasks in milliseconds.

**Type**: Integer  
**Required**: No  
**Default**: `3600000` (1 hour)  

**Example**:
```env
CLEANUP_INTERVAL=3600000
```

### TOKEN_USAGE_RETENTION

**Description**: How long to retain token usage data in milliseconds.

**Type**: Integer  
**Required**: No  
**Default**: `2592000000` (30 days)  

**Example**:
```env
TOKEN_USAGE_RETENTION=2592000000
```

### HEALTH_CHECK_INTERVAL

**Description**: Health check interval in milliseconds.

**Type**: Integer  
**Required**: No  
**Default**: `60000` (1 minute)  

**Example**:
```env
HEALTH_CHECK_INTERVAL=60000
```

### SYSTEM_TIMEZONE

**Description**: System timezone for date/time operations.

**Type**: String  
**Required**: No  
**Default**: `Asia/Shanghai`  

**Example**:
```env
SYSTEM_TIMEZONE=Asia/Shanghai
```

### TIMEZONE_OFFSET

**Description**: UTC timezone offset in hours.

**Type**: Integer  
**Required**: No  
**Default**: `8`  

**Example**:
```env
TIMEZONE_OFFSET=8
```

### DEFAULT_TOKEN_LIMIT

**Description**: Default token usage limit per API key.

**Type**: Integer  
**Required**: No  
**Default**: `1000000`  

**Example**:
```env
DEFAULT_TOKEN_LIMIT=1000000
```

---

## 🎨 Web Interface Configuration

### WEB_TITLE

**Description**: Web interface title.

**Type**: String  
**Required**: No  
**Default**: `Claude Relay Service`  

**Example**:
```env
WEB_TITLE=My Claude Relay
```

### WEB_DESCRIPTION

**Description**: Web interface description.

**Type**: String  
**Required**: No  
**Default**: `Multi-account Claude API relay service with beautiful management interface`  

**Example**:
```env
WEB_DESCRIPTION=Custom description
```

### WEB_LOGO_URL

**Description**: Logo URL for web interface.

**Type**: String  
**Required**: No  
**Default**: `/assets/logo.png`  

**Example**:
```env
WEB_LOGO_URL=/custom-logo.png
```

### ENABLE_CORS

**Description**: Enable CORS for API requests.

**Type**: Boolean  
**Required**: No  
**Default**: `true`  
**Values**: `true`, `false`  

**Example**:
```env
ENABLE_CORS=true
```

---

## 🔐 LDAP Authentication

### LDAP_ENABLED

**Description**: Enable LDAP authentication.

**Type**: Boolean  
**Required**: No  
**Default**: `false`  
**Values**: `true`, `false`  

**Example**:
```env
LDAP_ENABLED=true
```

### LDAP_URL

**Description**: LDAP server URL.

**Type**: String  
**Required**: If LDAP enabled  
**Default**: `ldap://localhost:389`  

**Example**:
```env
LDAP_URL=ldaps://ldap.example.com:636
```

### LDAP_BIND_DN

**Description**: LDAP bind distinguished name.

**Type**: String  
**Required**: If LDAP enabled  
**Default**: `cn=admin,dc=example,dc=com`  

**Example**:
```env
LDAP_BIND_DN=cn=admin,dc=example,dc=com
```

### LDAP_BIND_PASSWORD

**Description**: LDAP bind password.

**Type**: String  
**Required**: If LDAP enabled  
**Default**: `admin`  

**Example**:
```env
LDAP_BIND_PASSWORD=your-ldap-password
```

### LDAP_SEARCH_BASE

**Description**: LDAP search base DN.

**Type**: String  
**Required**: If LDAP enabled  
**Default**: `dc=example,dc=com`  

**Example**:
```env
LDAP_SEARCH_BASE=dc=example,dc=com
```

### LDAP_SEARCH_FILTER

**Description**: LDAP search filter template.

**Type**: String  
**Required**: No  
**Default**: `(uid={{username}})`  

**Example**:
```env
LDAP_SEARCH_FILTER=(uid={{username}})
```

---

## 👥 User Management

### USER_MANAGEMENT_ENABLED

**Description**: Enable user management features.

**Type**: Boolean  
**Required**: No  
**Default**: `false`  
**Values**: `true`, `false`  

**Example**:
```env
USER_MANAGEMENT_ENABLED=true
```

### DEFAULT_USER_ROLE

**Description**: Default role for new users.

**Type**: String  
**Required**: No  
**Default**: `user`  
**Values**: `admin`, `user`  

**Example**:
```env
DEFAULT_USER_ROLE=user
```

### USER_SESSION_TIMEOUT

**Description**: User session timeout in milliseconds.

**Type**: Integer  
**Required**: No  
**Default**: `86400000` (24 hours)  

**Example**:
```env
USER_SESSION_TIMEOUT=86400000
```

### MAX_API_KEYS_PER_USER

**Description**: Maximum API keys per user.

**Type**: Integer  
**Required**: No  
**Default**: `1`  

**Example**:
```env
MAX_API_KEYS_PER_USER=3
```

### ALLOW_USER_DELETE_API_KEYS

**Description**: Allow users to delete their own API keys.

**Type**: Boolean  
**Required**: No  
**Default**: `false`  
**Values**: `true`, `false`  

**Example**:
```env
ALLOW_USER_DELETE_API_KEYS=false
```

---

## 🔧 Advanced Configuration

### Session Management

#### STICKY_SESSION_TTL_HOURS

**Description**: Sticky session TTL in hours.

**Type**: Float  
**Required**: No  
**Default**: `1`  

**Example**:
```env
STICKY_SESSION_TTL_HOURS=2.5
```

#### STICKY_SESSION_RENEWAL_THRESHOLD_MINUTES

**Description**: Session renewal threshold in minutes.

**Type**: Integer  
**Required**: No  
**Default**: `0` (no renewal)  

**Example**:
```env
STICKY_SESSION_RENEWAL_THRESHOLD_MINUTES=15
```

### Webhook Configuration

#### WEBHOOK_ENABLED

**Description**: Enable webhook notifications.

**Type**: Boolean  
**Required**: No  
**Default**: `true`  
**Values**: `true`, `false`  

**Example**:
```env
WEBHOOK_ENABLED=true
```

#### WEBHOOK_URLS

**Description**: Webhook URLs (comma-separated).

**Type**: String  
**Required**: No  
**Default**: Empty  

**Example**:
```env
WEBHOOK_URLS=https://hook1.example.com,https://hook2.example.com
```

#### WEBHOOK_TIMEOUT

**Description**: Webhook request timeout in milliseconds.

**Type**: Integer  
**Required**: No  
**Default**: `10000` (10 seconds)  

**Example**:
```env
WEBHOOK_TIMEOUT=15000
```

#### WEBHOOK_RETRIES

**Description**: Number of webhook retry attempts.

**Type**: Integer  
**Required**: No  
**Default**: `3`  

**Example**:
```env
WEBHOOK_RETRIES=5
```

### Bedrock API (Optional)

#### CLAUDE_CODE_USE_BEDROCK

**Description**: Use AWS Bedrock instead of Claude API.

**Type**: Boolean  
**Required**: No  
**Default**: `0` (false)  
**Values**: `0` (false), `1` (true)  

**Example**:
```env
CLAUDE_CODE_USE_BEDROCK=1
```

#### AWS_REGION

**Description**: AWS region for Bedrock.

**Type**: String  
**Required**: If using Bedrock  
**Default**: `us-east-1`  

**Example**:
```env
AWS_REGION=us-west-2
```

---

## ✅ Validation

Run the validation script to check your environment:

```bash
npm run validate:env
```

Or directly:

```bash
node scripts/validate-env.js
```

The script will check:
- ✅ All required variables are set
- ✅ Values have valid formats
- ⚠️  Recommended variables warnings
- ℹ️  Default values being used

---

## 📚 Quick Start Templates

### Minimal Configuration (.env)

```env
# Required
JWT_SECRET=<generate-with-crypto>
ENCRYPTION_KEY=<32-char-hex-string>

# Recommended
PORT=3000
REDIS_HOST=localhost
REDIS_PASSWORD=<your-redis-password>
```

### Production Configuration (.env)

```env
# Required
JWT_SECRET=<generate-with-crypto>
ENCRYPTION_KEY=<32-char-hex-string>

# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
TRUST_PROXY=true

# Security
WEB_SESSION_SECRET=<generate-with-crypto>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong-password>

# Redis
REDIS_HOST=redis-server
REDIS_PORT=6379
REDIS_PASSWORD=<redis-password>
REDIS_ENABLE_TLS=true

# Logging
LOG_LEVEL=warn
LOG_MAX_SIZE=20m
LOG_MAX_FILES=14

# Web
ENABLE_CORS=true
WEB_TITLE=Production Claude Relay
```

---

## 🔒 Security Best Practices

1. **Never commit `.env` file to version control**
2. **Use strong random secrets** (generate with crypto module)
3. **Enable Redis password** in production
4. **Use TLS/SSL** for Redis connections
5. **Set strong admin password** or let it auto-generate
6. **Rotate secrets regularly** (quarterly recommended)
7. **Use environment-specific .env files** (.env.production, .env.staging)
8. **Restrict file permissions**: `chmod 600 .env`

---

## 🆘 Troubleshooting

### Validation Fails

```bash
# Check what's wrong
npm run validate:env

# Generate required secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))"
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(16).toString('hex'))"
```

### Missing .env File

```bash
# Copy template
cp .env.example .env

# Edit with your values
nano .env
```

### Variables Not Loading

```bash
# Verify dotenv is working
node -e "require('dotenv').config(); console.log(process.env.PORT)"

# Check file exists
ls -la .env

# Check file permissions
chmod 644 .env
```

---

*Last Updated: 2025-10-23*  
*Version: v1.1.183+*
