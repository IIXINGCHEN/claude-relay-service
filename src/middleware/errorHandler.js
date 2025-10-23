/**
 * 全局错误处理中间件
 * 捕获和处理所有未处理的错误，防止服务崩溃
 */

const logger = require('../utils/logger')
const sensitiveDataMasker = require('../utils/sensitiveDataMasker')
const config = require('../../config/config')

/**
 * 错误类型映射
 */
const ERROR_TYPES = {
  ValidationError: 400,
  UnauthorizedError: 401,
  ForbiddenError: 403,
  NotFoundError: 404,
  ConflictError: 409,
  TooManyRequestsError: 429,
  InternalServerError: 500,
  ServiceUnavailableError: 503
}

/**
 * 自定义错误类
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * 验证错误类
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
    this.details = details
  }
}

/**
 * 认证错误类
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
    this.name = 'UnauthorizedError'
  }
}

/**
 * 权限错误类
 */
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
    this.name = 'ForbiddenError'
  }
}

/**
 * 资源未找到错误类
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

/**
 * 冲突错误类
 */
class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409, 'CONFLICT')
    this.name = 'ConflictError'
  }
}

/**
 * 请求过多错误类
 */
class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message, 429, 'TOO_MANY_REQUESTS')
    this.name = 'TooManyRequestsError'
    this.retryAfter = retryAfter
  }
}

/**
 * 服务不可用错误类
 */
class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', retryAfter = 30) {
    super(message, 503, 'SERVICE_UNAVAILABLE')
    this.name = 'ServiceUnavailableError'
    this.retryAfter = retryAfter
  }
}

/**
 * 判断错误是否为操作性错误（可预期的业务错误）
 */
function isOperationalError(error) {
  if (error instanceof AppError) {
    return error.isOperational
  }
  return false
}

/**
 * 格式化错误消息（移除敏感信息）
 */
function formatErrorMessage(error) {
  // 移除文件路径等敏感信息
  let message = error.message || 'An error occurred'

  // 移除绝对路径，只保留相对路径
  message = message.replace(/[A-Z]:\\[^\s]+/gi, '[path]')
  message = message.replace(/\/[\w/]+\/([\w.-]+)$/g, '$1')

  // 移除可能的密钥或令牌
  message = sensitiveDataMasker.maskString(message)

  return message
}

/**
 * 格式化错误堆栈（生产环境不返回堆栈）
 */
function formatErrorStack(error) {
  if (config.nodeEnv === 'production') {
    return undefined
  }

  if (!error.stack) {
    return undefined
  }

  // 移除敏感信息
  return sensitiveDataMasker.maskString(error.stack)
}

/**
 * 异步错误包装器
 * 用于包装异步路由处理器，自动捕获Promise rejection
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

/**
 * 404 错误处理中间件
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Cannot ${req.method} ${req.originalUrl}`)
  next(error)
}

/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  // 如果响应已发送，直接返回
  if (res.headersSent) {
    logger.error('Error occurred after response was sent:', err)
    return next(err)
  }

  // 脱敏错误对象
  const maskedError = sensitiveDataMasker.maskError(err)

  // 确定错误状态码
  let statusCode = err.statusCode || err.status || 500

  // 根据错误类型设置状态码
  if (err.name && ERROR_TYPES[err.name]) {
    statusCode = ERROR_TYPES[err.name]
  }

  // 处理特定错误
  if (err.name === 'ValidationError' || err.name === 'CastError') {
    statusCode = 400
  } else if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
    statusCode = 401
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401
  } else if (err.code === 'ECONNREFUSED') {
    statusCode = 503
  } else if (err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
    statusCode = 504
  }

  // 记录错误日志
  const logLevel = statusCode >= 500 ? 'error' : 'warn'
  logger[logLevel]({
    message: `${req.method} ${req.originalUrl} - ${statusCode}`,
    error: maskedError,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    body: req.body ? sensitiveDataMasker.maskObject(req.body) : undefined,
    query: req.query,
    params: req.params,
    statusCode
  })

  // 构建错误响应
  const errorResponse = {
    error: {
      message: formatErrorMessage(err),
      code: err.code || 'INTERNAL_ERROR',
      statusCode
    }
  }

  // 开发环境添加更多调试信息
  if (config.nodeEnv !== 'production') {
    errorResponse.error.stack = formatErrorStack(err)
    errorResponse.error.details = err.details || undefined
  }

  // 添加重试头（如果适用）
  if (err.retryAfter) {
    res.set('Retry-After', err.retryAfter.toString())
  }

  // 发送错误响应
  res.status(statusCode).json(errorResponse)
}

/**
 * 未捕获异常处理器
 */
const setupUncaughtExceptionHandler = () => {
  process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught Exception:', {
      error: sensitiveDataMasker.maskError(error),
      stack: error.stack
    })

    // 给一些时间记录错误，然后优雅退出
    setTimeout(() => {
      process.exit(1)
    }, 1000)
  })
}

/**
 * 未处理的Promise rejection处理器
 */
const setupUnhandledRejectionHandler = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled Rejection:', {
      reason: sensitiveDataMasker.maskObject(reason),
      promise
    })

    // 在开发环境抛出错误
    if (config.nodeEnv === 'development') {
      throw reason
    }
  })
}

/**
 * 优雅关闭处理器
 */
const setupGracefulShutdown = (server) => {
  const gracefulShutdown = (signal) => {
    logger.info(`⚠️ ${signal} received, starting graceful shutdown...`)

    // 停止接受新连接
    server.close(() => {
      logger.info('✅ HTTP server closed')

      // 关闭数据库连接等资源
      // 这里可以添加关闭Redis连接等清理逻辑

      process.exit(0)
    })

    // 如果30秒后还未关闭，强制退出
    setTimeout(() => {
      logger.error('❌ Graceful shutdown timeout, forcing exit')
      process.exit(1)
    }, 30000)
  }

  // 监听终止信号
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
}

/**
 * 请求超时处理中间件
 */
const requestTimeoutHandler =
  (timeout = 30000) =>
  (req, res, next) => {
    // 设置请求超时
    req.setTimeout(timeout, () => {
      const error = new ServiceUnavailableError('Request timeout')
      error.code = 'REQUEST_TIMEOUT'
      next(error)
    })

    // 设置响应超时
    res.setTimeout(timeout, () => {
      const error = new ServiceUnavailableError('Response timeout')
      error.code = 'RESPONSE_TIMEOUT'
      next(error)
    })

    next()
  }

module.exports = {
  // 错误类
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  TooManyRequestsError,
  ServiceUnavailableError,

  // 工具函数
  isOperationalError,
  asyncHandler,

  // 中间件
  notFoundHandler,
  errorHandler,
  requestTimeoutHandler,

  // 设置函数
  setupUncaughtExceptionHandler,
  setupUnhandledRejectionHandler,
  setupGracefulShutdown
}
