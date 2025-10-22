/**
 * 输入验证工具类
 * 提供各种输入验证和清理功能，防止注入攻击
 */

const crypto = require('crypto')

class InputValidator {
  /**
   * 验证用户名
   * @param {string} username - 用户名
   * @returns {string} 验证后的用户名
   * @throws {Error} 如果用户名无效
   */
  validateUsername(username) {
    if (!username || typeof username !== 'string') {
      throw new Error('用户名必须是非空字符串')
    }

    const trimmed = username.trim()

    // 长度检查
    if (trimmed.length < 3 || trimmed.length > 64) {
      throw new Error('用户名长度必须在3-64个字符之间')
    }

    // 格式检查：只允许字母、数字、下划线、连字符
    const usernameRegex = /^[a-zA-Z0-9_-]+$/
    if (!usernameRegex.test(trimmed)) {
      throw new Error('用户名只能包含字母、数字、下划线和连字符')
    }

    // 不能以连字符开头或结尾
    if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
      throw new Error('用户名不能以连字符开头或结尾')
    }

    return trimmed
  }

  /**
   * 验证电子邮件
   * @param {string} email - 电子邮件地址
   * @returns {string} 验证后的电子邮件
   * @throws {Error} 如果电子邮件无效
   */
  validateEmail(email) {
    if (!email || typeof email !== 'string') {
      throw new Error('电子邮件必须是非空字符串')
    }

    const trimmed = email.trim().toLowerCase()

    // 基本格式验证
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/
    if (!emailRegex.test(trimmed)) {
      throw new Error('电子邮件格式无效')
    }

    // 长度限制
    if (trimmed.length > 254) {
      throw new Error('电子邮件地址过长')
    }

    return trimmed
  }

  /**
   * 验证密码强度
   * @param {string} password - 密码
   * @returns {boolean} 验证结果
   */
  validatePassword(password) {
    if (!password || typeof password !== 'string') {
      throw new Error('密码必须是非空字符串')
    }

    // 最小长度
    if (password.length < 8) {
      throw new Error('密码至少需要8个字符')
    }

    // 最大长度（防止DoS攻击）
    if (password.length > 128) {
      throw new Error('密码不能超过128个字符')
    }

    return true
  }

  /**
   * 验证角色
   * @param {string} role - 用户角色
   * @returns {string} 验证后的角色
   * @throws {Error} 如果角色无效
   */
  validateRole(role) {
    const validRoles = ['admin', 'user', 'viewer']

    if (!role || typeof role !== 'string') {
      throw new Error('角色必须是非空字符串')
    }

    const trimmed = role.trim().toLowerCase()

    if (!validRoles.includes(trimmed)) {
      throw new Error(`角色必须是以下之一: ${validRoles.join(', ')}`)
    }

    return trimmed
  }

  /**
   * 验证Webhook URL
   * @param {string} url - Webhook URL
   * @returns {string} 验证后的URL
   * @throws {Error} 如果URL无效
   */
  validateWebhookUrl(url) {
    if (!url || typeof url !== 'string') {
      throw new Error('Webhook URL必须是非空字符串')
    }

    const trimmed = url.trim()

    // URL格式验证
    try {
      const urlObj = new URL(trimmed)

      // 只允许HTTP和HTTPS协议
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        throw new Error('Webhook URL必须使用HTTP或HTTPS协议')
      }

      // 防止SSRF攻击：禁止访问内网地址
      const hostname = urlObj.hostname.toLowerCase()
      const dangerousHosts = [
        'localhost',
        '127.0.0.1',
        '0.0.0.0',
        '::1',
        '169.254.169.254', // AWS元数据服务
        'metadata.google.internal' // GCP元数据服务
      ]

      if (dangerousHosts.includes(hostname)) {
        throw new Error('Webhook URL不能指向内部服务')
      }

      // 检查是否是内网IP
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
      if (ipRegex.test(hostname)) {
        const parts = hostname.split('.').map(Number)

        // 检查私有IP范围
        if (
          parts[0] === 10 || // 10.0.0.0/8
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || // 172.16.0.0/12
          (parts[0] === 192 && parts[1] === 168) // 192.168.0.0/16
        ) {
          throw new Error('Webhook URL不能指向私有IP地址')
        }
      }

      return trimmed
    } catch (error) {
      if (error.message.includes('Webhook URL')) {
        throw error
      }
      throw new Error('Webhook URL格式无效')
    }
  }

  /**
   * 验证显示名称
   * @param {string} displayName - 显示名称
   * @returns {string} 验证后的显示名称
   * @throws {Error} 如果显示名称无效
   */
  validateDisplayName(displayName) {
    if (!displayName || typeof displayName !== 'string') {
      throw new Error('显示名称必须是非空字符串')
    }

    const trimmed = displayName.trim()

    // 长度检查
    if (trimmed.length < 1 || trimmed.length > 100) {
      throw new Error('显示名称长度必须在1-100个字符之间')
    }

    // 禁止特殊控制字符（排除常见的换行和制表符）
    // eslint-disable-next-line no-control-regex
    const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/
    if (controlCharRegex.test(trimmed)) {
      throw new Error('显示名称不能包含控制字符')
    }

    return trimmed
  }

  /**
   * 清理HTML标签（防止XSS）
   * @param {string} input - 输入字符串
   * @returns {string} 清理后的字符串
   */
  sanitizeHtml(input) {
    if (!input || typeof input !== 'string') {
      return ''
    }

    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  /**
   * 验证API Key名称
   * @param {string} name - API Key名称
   * @returns {string} 验证后的名称
   * @throws {Error} 如果名称无效
   */
  validateApiKeyName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('API Key名称必须是非空字符串')
    }

    const trimmed = name.trim()

    // 长度检查
    if (trimmed.length < 1 || trimmed.length > 100) {
      throw new Error('API Key名称长度必须在1-100个字符之间')
    }

    // 禁止特殊控制字符（排除常见的换行和制表符）
    // eslint-disable-next-line no-control-regex
    const controlCharRegex = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/
    if (controlCharRegex.test(trimmed)) {
      throw new Error('API Key名称不能包含控制字符')
    }

    return trimmed
  }

  /**
   * 验证分页参数
   * @param {number} page - 页码
   * @param {number} limit - 每页数量
   * @returns {{page: number, limit: number}} 验证后的分页参数
   */
  validatePagination(page, limit) {
    const pageNum = parseInt(page, 10) || 1
    const limitNum = parseInt(limit, 10) || 20

    if (pageNum < 1) {
      throw new Error('页码必须大于0')
    }

    if (limitNum < 1 || limitNum > 100) {
      throw new Error('每页数量必须在1-100之间')
    }

    return {
      page: pageNum,
      limit: limitNum
    }
  }

  /**
   * 验证UUID格式
   * @param {string} uuid - UUID字符串
   * @returns {string} 验证后的UUID
   * @throws {Error} 如果UUID无效
   */
  validateUuid(uuid) {
    if (!uuid || typeof uuid !== 'string') {
      throw new Error('UUID必须是非空字符串')
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidRegex.test(uuid)) {
      throw new Error('UUID格式无效')
    }

    return uuid.toLowerCase()
  }

  /**
   * 防止XSS攻击 - HTML实体编码
   * @param {string} str - 要编码的字符串
   * @returns {string} 编码后的字符串
   */
  escapeHtml(str) {
    if (!str) {
      return ''
    }

    const htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
      '`': '&#x60;',
      '=': '&#x3D;'
    }

    return String(str).replace(/[&<>"'`=/]/g, (match) => htmlEscapes[match])
  }

  /**
   * 防止SQL注入 - 参数化查询转义
   * @param {string} str - 要转义的字符串
   * @returns {string} 转义后的字符串
   */
  escapeSql(str) {
    if (!str) {
      return ''
    }

    // 转义单引号
    return String(str).replace(/'/g, "''")
  }

  /**
   * 防止命令注入 - shell命令转义
   * @param {string} str - 要转义的字符串
   * @returns {string} 转义后的字符串
   */
  escapeShell(str) {
    if (!str) {
      return ''
    }

    // 移除危险字符
    return String(str).replace(/[`$(){}[\]|&;<>\\!]/g, '')
  }

  /**
   * 验证和清理JSON输入
   * @param {*} data - 要验证的数据
   * @param {number} maxDepth - 最大嵌套深度
   * @returns {*} 清理后的数据
   */
  sanitizeJson(data, maxDepth = 10) {
    const seen = new WeakSet()

    const sanitize = (obj, depth = 0) => {
      if (depth > maxDepth) {
        throw new Error(`JSON嵌套深度超过限制 (${maxDepth})`)
      }

      if (obj === null || obj === undefined) {
        return obj
      }

      // 处理原始类型
      if (typeof obj !== 'object') {
        if (typeof obj === 'string') {
          // 清理字符串中的控制字符
          return obj.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // eslint-disable-line no-control-regex
        }
        return obj
      }

      // 检查循环引用
      if (seen.has(obj)) {
        throw new Error('检测到循环引用')
      }
      seen.add(obj)

      // 处理数组
      if (Array.isArray(obj)) {
        return obj.map((item) => sanitize(item, depth + 1))
      }

      // 处理对象
      const result = {}
      for (const [key, value] of Object.entries(obj)) {
        // 验证键名
        if (typeof key !== 'string' || key.length > 100) {
          throw new Error('无效的对象键名')
        }

        // 清理键名中的危险字符
        const cleanKey = key.replace(/[^\w.-]/g, '_')
        result[cleanKey] = sanitize(value, depth + 1)
      }

      return result
    }

    return sanitize(data)
  }

  /**
   * 验证文件名
   * @param {string} filename - 文件名
   * @returns {string} 验证后的文件名
   */
  validateFilename(filename) {
    if (!filename || typeof filename !== 'string') {
      throw new Error('文件名必须是非空字符串')
    }

    // 移除路径遍历字符
    let clean = filename.replace(/\.\./g, '').replace(/[/\\]/g, '').trim()

    // 检查文件名长度
    if (clean.length === 0 || clean.length > 255) {
      throw new Error('文件名长度无效')
    }

    // 移除危险字符
    clean = clean.replace(/[<>:"|?*\x00-\x1F]/g, '_') // eslint-disable-line no-control-regex

    // 不允许以点开头（隐藏文件）
    if (clean.startsWith('.')) {
      clean = `_${clean.substring(1)}`
    }

    return clean
  }

  /**
   * 验证URL参数
   * @param {Object} params - URL参数对象
   * @param {Array<string>} allowedKeys - 允许的参数键列表
   * @returns {Object} 验证后的参数
   */
  validateUrlParams(params, allowedKeys = []) {
    if (!params || typeof params !== 'object') {
      return {}
    }

    const validated = {}

    for (const [key, value] of Object.entries(params)) {
      // 检查键是否在允许列表中
      if (allowedKeys.length > 0 && !allowedKeys.includes(key)) {
        continue
      }

      // 验证键名
      if (!/^[\w.-]+$/.test(key) || key.length > 50) {
        continue
      }

      // 验证值
      if (value === null || value === undefined) {
        continue
      }

      if (Array.isArray(value)) {
        validated[key] = value.map((v) => this.escapeHtml(String(v)))
      } else {
        validated[key] = this.escapeHtml(String(value))
      }
    }

    return validated
  }

  /**
   * 生成CSRF令牌
   * @returns {string} CSRF令牌
   */
  generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * 验证CSRF令牌
   * @param {string} token - 要验证的令牌
   * @param {string} expectedToken - 预期的令牌
   * @returns {boolean} 是否有效
   */
  validateCsrfToken(token, expectedToken) {
    if (!token || !expectedToken) {
      return false
    }

    // 使用时间安全比较防止时序攻击
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expectedToken))
  }

  /**
   * 限制字符串长度
   * @param {string} str - 要限制的字符串
   * @param {number} maxLength - 最大长度
   * @returns {string} 截断后的字符串
   */
  truncateString(str, maxLength = 1000) {
    if (!str || typeof str !== 'string') {
      return ''
    }

    if (str.length <= maxLength) {
      return str
    }

    return `${str.substring(0, maxLength - 3)}...`
  }

  /**
   * 验证整数
   * @param {*} value - 要验证的值
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   * @returns {number} 验证后的整数
   */
  validateInteger(value, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) {
    const num = parseInt(value, 10)

    if (isNaN(num)) {
      throw new Error('值必须是整数')
    }

    if (num < min || num > max) {
      throw new Error(`值必须在 ${min} 到 ${max} 之间`)
    }

    return num
  }

  /**
   * 验证浮点数
   * @param {*} value - 要验证的值
   * @param {number} min - 最小值
   * @param {number} max - 最大值
   * @returns {number} 验证后的浮点数
   */
  validateFloat(value, min = -Infinity, max = Infinity) {
    const num = parseFloat(value)

    if (isNaN(num)) {
      throw new Error('值必须是数字')
    }

    if (num < min || num > max) {
      throw new Error(`值必须在 ${min} 到 ${max} 之间`)
    }

    return num
  }
}

module.exports = new InputValidator()
