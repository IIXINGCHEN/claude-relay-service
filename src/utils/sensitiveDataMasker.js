/**
 * 敏感数据脱敏工具
 * 用于在日志记录前自动脱敏敏感信息
 */

// const logger = require('./logger')

class SensitiveDataMasker {
  constructor() {
    // 定义敏感字段模式
    this.sensitivePatterns = [
      // API Keys 和 Tokens
      { pattern: /\bcr_[a-zA-Z0-9]{64}\b/g, replacement: 'cr_****[MASKED]' },
      { pattern: /\bsk-[a-zA-Z0-9-_]{20,}\b/g, replacement: 'sk-****[MASKED]' },
      { pattern: /\bBearer\s+[a-zA-Z0-9._-]{20,}\b/gi, replacement: 'Bearer ****[MASKED]' },

      // OAuth Tokens
      {
        pattern: /"access_token"\s*:\s*"[^"]+"/g,
        replacement: '"access_token":"****[MASKED]"'
      },
      {
        pattern: /"refresh_token"\s*:\s*"[^"]+"/g,
        replacement: '"refresh_token":"****[MASKED]"'
      },
      { pattern: /"id_token"\s*:\s*"[^"]+"/g, replacement: '"id_token":"****[MASKED]"' },

      // Authorization Headers
      {
        pattern: /"authorization"\s*:\s*"[^"]+"/gi,
        replacement: '"authorization":"****[MASKED]"'
      },
      { pattern: /"x-api-key"\s*:\s*"[^"]+"/gi, replacement: '"x-api-key":"****[MASKED]"' },

      // Passwords
      { pattern: /"password"\s*:\s*"[^"]+"/gi, replacement: '"password":"****[MASKED]"' },
      {
        pattern: /"passwordHash"\s*:\s*"[^"]+"/gi,
        replacement: '"passwordHash":"****[MASKED]"'
      },
      { pattern: /password=\S+/gi, replacement: 'password=****[MASKED]' },

      // Email addresses (部分脱敏)
      {
        pattern: /\b([a-zA-Z0-9._%+-]{1,3})[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
        replacement: '$1***@$2'
      },

      // AWS Credentials
      {
        pattern: /"accessKeyId"\s*:\s*"[^"]+"/g,
        replacement: '"accessKeyId":"****[MASKED]"'
      },
      {
        pattern: /"secretAccessKey"\s*:\s*"[^"]+"/g,
        replacement: '"secretAccessKey":"****[MASKED]"'
      },
      {
        pattern: /"sessionToken"\s*:\s*"[^"]+"/g,
        replacement: '"sessionToken":"****[MASKED]"'
      },

      // Proxy credentials
      { pattern: /\/\/[^:]+:[^@]+@/g, replacement: '//****:****@' },

      // Cookie
      { pattern: /Cookie:\s*[^\r\n]+/gi, replacement: 'Cookie: ****[MASKED]' },
      { pattern: /Set-Cookie:\s*[^\r\n]+/gi, replacement: 'Set-Cookie: ****[MASKED]' }
    ]

    // 定义敏感字段名（用于对象脱敏）
    this.sensitiveFields = [
      'password',
      'passwordHash',
      'apiKey',
      'api_key',
      'accessToken',
      'access_token',
      'refreshToken',
      'refresh_token',
      'idToken',
      'id_token',
      'authorization',
      'cookie',
      'set-cookie',
      'x-api-key',
      'x-goog-api-key',
      'accessKeyId',
      'secretAccessKey',
      'sessionToken',
      'proxyAuth',
      'encryptionKey',
      'jwtSecret'
    ]
  }

  /**
   * 脱敏字符串
   */
  maskString(str) {
    if (typeof str !== 'string') {
      return str
    }

    let masked = str
    for (const { pattern, replacement } of this.sensitivePatterns) {
      masked = masked.replace(pattern, replacement)
    }

    return masked
  }

  /**
   * 脱敏对象（递归）
   */
  maskObject(obj, depth = 0) {
    // 防止无限递归
    if (depth > 10) {
      return '[MAX_DEPTH_REACHED]'
    }

    if (obj === null || obj === undefined) {
      return obj
    }

    // 处理数组
    if (Array.isArray(obj)) {
      return obj.map((item) => this.maskObject(item, depth + 1))
    }

    // 处理普通对象
    if (typeof obj === 'object') {
      const masked = {}
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase()

        // 检查是否为敏感字段
        if (this.sensitiveFields.some((field) => lowerKey.includes(field.toLowerCase()))) {
          // 敏感字段脱敏
          if (typeof value === 'string') {
            masked[key] = this._maskSensitiveValue(value)
          } else {
            masked[key] = '****[MASKED]'
          }
        } else if (typeof value === 'object') {
          // 递归处理嵌套对象
          masked[key] = this.maskObject(value, depth + 1)
        } else if (typeof value === 'string') {
          // 对字符串值应用正则脱敏
          masked[key] = this.maskString(value)
        } else {
          masked[key] = value
        }
      }
      return masked
    }

    // 处理字符串
    if (typeof obj === 'string') {
      return this.maskString(obj)
    }

    // 其他类型直接返回
    return obj
  }

  /**
   * 脱敏敏感值（保留部分字符）
   */
  _maskSensitiveValue(value) {
    if (!value || typeof value !== 'string') {
      return '****[MASKED]'
    }

    // 对于短值，完全脱敏
    if (value.length <= 8) {
      return '****[MASKED]'
    }

    // 对于长值，保留前3后4个字符
    const prefix = value.substring(0, 3)
    const suffix = value.substring(value.length - 4)
    return `${prefix}****${suffix}`
  }

  /**
   * 脱敏HTTP请求
   */
  maskHttpRequest(req) {
    if (!req) {
      return req
    }

    const masked = {
      method: req.method,
      url: this.maskString(req.url || req.originalUrl || ''),
      headers: this.maskObject(req.headers || {}),
      query: this.maskObject(req.query || {}),
      body: this.maskObject(req.body || {})
    }

    return masked
  }

  /**
   * 脱敏HTTP响应
   */
  maskHttpResponse(res) {
    if (!res) {
      return res
    }

    const masked = {
      statusCode: res.statusCode,
      statusMessage: res.statusMessage,
      headers: this.maskObject(res.getHeaders ? res.getHeaders() : {})
    }

    return masked
  }

  /**
   * 脱敏错误对象
   */
  maskError(error) {
    if (!error) {
      return error
    }

    const masked = {
      message: this.maskString(error.message || ''),
      name: error.name,
      code: error.code,
      stack: this.maskString(error.stack || '')
    }

    // 保留其他非敏感字段
    for (const [key, value] of Object.entries(error)) {
      if (!masked[key] && key !== 'message' && key !== 'stack') {
        if (typeof value === 'object') {
          masked[key] = this.maskObject(value)
        } else if (typeof value === 'string') {
          masked[key] = this.maskString(value)
        } else {
          masked[key] = value
        }
      }
    }

    return masked
  }
}

// 导出单例
const sensitiveDataMasker = new SensitiveDataMasker()

module.exports = sensitiveDataMasker
