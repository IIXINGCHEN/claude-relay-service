/**
 * 标准化响应工具
 * 确保所有API响应格式一致，状态码正确，消息用户友好
 */

const logger = require('./logger')
const config = require('../../config/config')

/**
 * 错误代码映射
 */
const ERROR_CODES = {
  // 4xx 客户端错误
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',

  // 5xx 服务器错误
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  BAD_GATEWAY: 'BAD_GATEWAY',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',

  // 业务错误
  ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  UPSTREAM_ERROR: 'UPSTREAM_ERROR',
  INVALID_API_KEY: 'INVALID_API_KEY',
  PERMISSION_DENIED: 'PERMISSION_DENIED'
}

/**
 * 用户友好的错误消息
 */
const USER_FRIENDLY_MESSAGES = {
  [ERROR_CODES.VALIDATION_ERROR]: '请求参数验证失败',
  [ERROR_CODES.INVALID_REQUEST]: '无效的请求格式',
  [ERROR_CODES.UNAUTHORIZED]: '认证失败，请检查您的凭据',
  [ERROR_CODES.FORBIDDEN]: '您没有权限访问此资源',
  [ERROR_CODES.NOT_FOUND]: '请求的资源不存在',
  [ERROR_CODES.METHOD_NOT_ALLOWED]: '不支持的请求方法',
  [ERROR_CODES.CONFLICT]: '资源冲突，请稍后重试',
  [ERROR_CODES.RATE_LIMITED]: '请求过于频繁，请稍后再试',
  [ERROR_CODES.REQUEST_TIMEOUT]: '请求超时，请重试',

  [ERROR_CODES.INTERNAL_ERROR]: '服务器内部错误，我们正在处理',
  [ERROR_CODES.BAD_GATEWAY]: '上游服务响应异常',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: '服务暂时不可用，请稍后再试',
  [ERROR_CODES.GATEWAY_TIMEOUT]: '上游服务响应超时',

  [ERROR_CODES.ACCOUNT_DISABLED]: '账号已被禁用',
  [ERROR_CODES.QUOTA_EXCEEDED]: '配额已用完',
  [ERROR_CODES.UPSTREAM_ERROR]: '上游服务错误',
  [ERROR_CODES.INVALID_API_KEY]: 'API密钥无效或已过期',
  [ERROR_CODES.PERMISSION_DENIED]: '权限不足，无法执行此操作'
}

/**
 * 错误代码到HTTP状态码的映射
 */
const ERROR_STATUS_CODES = {
  [ERROR_CODES.VALIDATION_ERROR]: 400,
  [ERROR_CODES.INVALID_REQUEST]: 400,
  [ERROR_CODES.UNAUTHORIZED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.METHOD_NOT_ALLOWED]: 405,
  [ERROR_CODES.REQUEST_TIMEOUT]: 408,
  [ERROR_CODES.CONFLICT]: 409,
  [ERROR_CODES.RATE_LIMITED]: 429,

  [ERROR_CODES.INTERNAL_ERROR]: 500,
  [ERROR_CODES.BAD_GATEWAY]: 502,
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 503,
  [ERROR_CODES.GATEWAY_TIMEOUT]: 504,

  [ERROR_CODES.ACCOUNT_DISABLED]: 403,
  [ERROR_CODES.QUOTA_EXCEEDED]: 429,
  [ERROR_CODES.UPSTREAM_ERROR]: 502,
  [ERROR_CODES.INVALID_API_KEY]: 401,
  [ERROR_CODES.PERMISSION_DENIED]: 403
}

class StandardResponses {
  /**
   * 发送成功响应
   */
  static success(res, data = null, message = 'Success', statusCode = 200) {
    const response = {
      success: true,
      message,
      data
    }

    return res.status(statusCode).json(response)
  }

  /**
   * 发送创建成功响应
   */
  static created(res, data = null, message = 'Resource created successfully') {
    return this.success(res, data, message, 201)
  }

  /**
   * 发送无内容响应
   */
  static noContent(res) {
    return res.status(204).send()
  }

  /**
   * 发送错误响应
   */
  static error(res, errorCode, details = null, customMessage = null) {
    const statusCode = ERROR_STATUS_CODES[errorCode] || 500
    const message = customMessage || USER_FRIENDLY_MESSAGES[errorCode] || '发生了错误'

    const response = {
      success: false,
      error: {
        code: errorCode,
        message,
        timestamp: new Date().toISOString()
      }
    }

    // 在开发环境添加详细信息
    if (config.nodeEnv === 'development' && details) {
      response.error.details = details
    } else if (details && typeof details === 'object') {
      // 生产环境只添加安全的详细信息
      if (details.suggestion) {
        response.error.suggestion = details.suggestion
      }
      if (details.retryAfter) {
        response.error.retryAfter = details.retryAfter
        res.setHeader('Retry-After', details.retryAfter.toString())
      }
      if (details.field) {
        response.error.field = details.field
      }
    }

    // 记录错误日志
    logger.error(`API Error Response: ${errorCode}`, {
      statusCode,
      errorCode,
      message,
      details: config.nodeEnv === 'development' ? details : undefined
    })

    return res.status(statusCode).json(response)
  }

  /**
   * 发送验证错误响应
   */
  static validationError(res, errors, message = '请求参数验证失败') {
    return this.error(
      res,
      ERROR_CODES.VALIDATION_ERROR,
      {
        errors,
        suggestion: '请检查请求参数是否正确'
      },
      message
    )
  }

  /**
   * 发送认证错误响应
   */
  static unauthorized(res, message = '认证失败') {
    return this.error(
      res,
      ERROR_CODES.UNAUTHORIZED,
      {
        suggestion: '请提供有效的认证凭据'
      },
      message
    )
  }

  /**
   * 发送权限错误响应
   */
  static forbidden(res, message = '权限不足') {
    return this.error(
      res,
      ERROR_CODES.FORBIDDEN,
      {
        suggestion: '请联系管理员获取相应权限'
      },
      message
    )
  }

  /**
   * 发送未找到错误响应
   */
  static notFound(res, resource = '资源', message = null) {
    return this.error(
      res,
      ERROR_CODES.NOT_FOUND,
      {
        resource,
        suggestion: '请检查请求的资源ID是否正确'
      },
      message || `${resource}不存在`
    )
  }

  /**
   * 发送速率限制错误响应
   */
  static rateLimited(res, retryAfter = 60, message = '请求过于频繁') {
    return this.error(
      res,
      ERROR_CODES.RATE_LIMITED,
      {
        retryAfter,
        suggestion: `请等待${retryAfter}秒后重试`
      },
      message
    )
  }

  /**
   * 发送内部错误响应（生产环境隐藏详情）
   */
  static internalError(res, error = null, message = '服务器内部错误') {
    // 记录详细错误
    logger.error('Internal Server Error:', error)

    const details =
      config.nodeEnv === 'development' && error
        ? {
            message: error.message,
            stack: error.stack
          }
        : {
            suggestion: '请稍后重试，如果问题持续，请联系技术支持'
          }

    return this.error(res, ERROR_CODES.INTERNAL_ERROR, details, message)
  }

  /**
   * 发送网关错误响应
   */
  static badGateway(res, message = '上游服务错误') {
    return this.error(
      res,
      ERROR_CODES.BAD_GATEWAY,
      {
        suggestion: '上游服务暂时无法响应，请稍后重试'
      },
      message
    )
  }

  /**
   * 发送服务不可用响应
   */
  static serviceUnavailable(res, retryAfter = 30, message = '服务暂时不可用') {
    return this.error(
      res,
      ERROR_CODES.SERVICE_UNAVAILABLE,
      {
        retryAfter,
        suggestion: `服务正在维护或升级，请${retryAfter}秒后重试`
      },
      message
    )
  }

  /**
   * 发送网关超时响应
   */
  static gatewayTimeout(res, message = '上游服务响应超时') {
    return this.error(
      res,
      ERROR_CODES.GATEWAY_TIMEOUT,
      {
        suggestion: '请求处理时间过长，请稍后重试'
      },
      message
    )
  }

  /**
   * 根据错误对象智能选择响应
   */
  static fromError(res, error) {
    // 检查是否是已知的应用错误
    if (error.statusCode) {
      switch (error.statusCode) {
        case 400:
          return this.validationError(res, error.details, error.message)
        case 401:
          return this.unauthorized(res, error.message)
        case 403:
          return this.forbidden(res, error.message)
        case 404:
          return this.notFound(res, error.resource, error.message)
        case 429:
          return this.rateLimited(res, error.retryAfter, error.message)
        case 502:
          return this.badGateway(res, error.message)
        case 503:
          return this.serviceUnavailable(res, error.retryAfter, error.message)
        case 504:
          return this.gatewayTimeout(res, error.message)
        default:
          return this.internalError(res, error)
      }
    }

    // 处理特定错误类型
    if (error.code === 'ECONNREFUSED') {
      return this.serviceUnavailable(res, 60, '无法连接到后端服务')
    }

    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return this.gatewayTimeout(res, '请求超时')
    }

    if (error.name === 'ValidationError') {
      return this.validationError(res, error.errors, error.message)
    }

    if (error.name === 'UnauthorizedError') {
      return this.unauthorized(res, error.message)
    }

    // 默认内部错误
    return this.internalError(res, error)
  }
}

module.exports = {
  StandardResponses,
  ERROR_CODES,
  USER_FRIENDLY_MESSAGES,
  ERROR_STATUS_CODES
}
