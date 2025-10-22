/**
 * 流处理资源管理器
 * 统一管理流资源，防止内存泄漏
 */

const logger = require('./logger')

class StreamManager {
  constructor() {
    // 存储活动的流和相关资源
    this.activeStreams = new Map()
    this.activeTimers = new Map()
    this.activeControllers = new Map()

    // 定期清理检查
    this.cleanupInterval = setInterval(() => {
      this.performCleanup()
    }, 60000) // 每分钟检查一次

    // 不阻止进程退出
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref()
    }

    // 进程退出时清理
    process.once('exit', () => this.cleanupAll())
    process.once('SIGTERM', () => this.cleanupAll())
    process.once('SIGINT', () => this.cleanupAll())
  }

  /**
   * 注册流资源
   * @param {string} id - 唯一标识符
   * @param {Object} resources - 资源对象
   */
  registerStream(id, resources = {}) {
    const { stream, controller, timer, cleanup } = resources

    if (stream) {
      this.activeStreams.set(id, { stream, cleanup })

      // 监听流事件
      this._attachStreamListeners(id, stream)
    }

    if (controller) {
      this.activeControllers.set(id, controller)
    }

    if (timer) {
      this.activeTimers.set(id, timer)
    }

    logger.debug(`📝 Stream registered: ${id}`)
  }

  /**
   * 附加流事件监听器
   * @private
   */
  _attachStreamListeners(id, stream) {
    const cleanup = () => this.cleanupStream(id)

    // 监听各种结束事件
    const events = ['end', 'close', 'error', 'finish']
    events.forEach((event) => {
      stream.once(event, () => {
        logger.debug(`📌 Stream ${event} event: ${id}`)
        cleanup()
      })
    })

    // 超时清理（30分钟）
    const timeout = setTimeout(
      () => {
        logger.warn(`⏱️ Stream timeout, cleaning up: ${id}`)
        cleanup()
      },
      30 * 60 * 1000
    )

    if (timeout.unref) {
      timeout.unref()
    }

    // 存储超时定时器
    const existingTimer = this.activeTimers.get(id)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }
    this.activeTimers.set(id, timeout)
  }

  /**
   * 清理特定流资源
   * @param {string} id - 流标识符
   */
  cleanupStream(id) {
    try {
      // 清理流
      const streamInfo = this.activeStreams.get(id)
      if (streamInfo) {
        const { stream, cleanup } = streamInfo

        // 执行自定义清理函数
        if (typeof cleanup === 'function') {
          try {
            cleanup()
          } catch (error) {
            logger.error(`Error in custom cleanup for stream ${id}:`, error)
          }
        }

        // 销毁流
        if (stream && typeof stream.destroy === 'function') {
          try {
            if (!stream.destroyed) {
              stream.destroy()
            }
          } catch (error) {
            logger.error(`Error destroying stream ${id}:`, error)
          }
        }

        // 移除所有监听器
        if (stream && typeof stream.removeAllListeners === 'function') {
          stream.removeAllListeners()
        }

        this.activeStreams.delete(id)
      }

      // 清理控制器
      const controller = this.activeControllers.get(id)
      if (controller) {
        try {
          if (!controller.signal.aborted) {
            controller.abort()
          }
        } catch (error) {
          logger.error(`Error aborting controller ${id}:`, error)
        }
        this.activeControllers.delete(id)
      }

      // 清理定时器
      const timer = this.activeTimers.get(id)
      if (timer) {
        clearTimeout(timer)
        this.activeTimers.delete(id)
      }

      logger.debug(`🧹 Stream cleaned up: ${id}`)
    } catch (error) {
      logger.error(`Error cleaning up stream ${id}:`, error)
    }
  }

  /**
   * 执行定期清理
   * @private
   */
  performCleanup() {
    // const now = Date.now() // 暂时未使用
    let cleanedCount = 0

    // 检查并清理超时的流
    for (const [id, info] of this.activeStreams.entries()) {
      if (info.stream && info.stream.destroyed) {
        this.cleanupStream(id)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      logger.info(`🧹 Periodic cleanup: ${cleanedCount} streams cleaned`)
    }
  }

  /**
   * 清理所有资源
   */
  cleanupAll() {
    logger.info('🧹 Cleaning up all stream resources...')

    // 清理所有流
    for (const id of this.activeStreams.keys()) {
      this.cleanupStream(id)
    }

    // 清理定期任务
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    logger.info('✅ All stream resources cleaned')
  }

  /**
   * 创建受管理的 AbortController
   * @param {string} id - 标识符
   * @returns {AbortController}
   */
  createAbortController(id) {
    const controller = new AbortController()
    this.activeControllers.set(id, controller)

    // 监听 abort 事件
    controller.signal.addEventListener('abort', () => {
      logger.debug(`🛑 AbortController aborted: ${id}`)
      this.cleanupStream(id)
    })

    return controller
  }

  /**
   * 创建安全的流包装器
   * @param {Stream} stream - 原始流
   * @param {string} id - 标识符
   * @returns {Stream} 包装后的流
   */
  wrapStream(stream, id) {
    // 注册流
    this.registerStream(id, { stream })

    // 返回代理对象，确保正确清理
    return new Proxy(stream, {
      get: (target, prop) => {
        // 拦截 destroy 方法
        if (prop === 'destroy') {
          return (...args) => {
            this.cleanupStream(id)
            if (typeof target.destroy === 'function') {
              return target.destroy(...args)
            }
          }
        }

        // 拦截 end 方法
        if (prop === 'end') {
          return (...args) => {
            const result = target.end(...args)
            // 延迟清理，让流有时间完成
            setTimeout(() => this.cleanupStream(id), 1000)
            return result
          }
        }

        return target[prop]
      }
    })
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      activeStreams: this.activeStreams.size,
      activeControllers: this.activeControllers.size,
      activeTimers: this.activeTimers.size,
      totalResources: this.activeStreams.size + this.activeControllers.size + this.activeTimers.size
    }
  }

  /**
   * 检查资源是否存在
   * @param {string} id - 标识符
   * @returns {boolean}
   */
  hasResource(id) {
    return this.activeStreams.has(id) || this.activeControllers.has(id) || this.activeTimers.has(id)
  }
}

// 导出单例
module.exports = new StreamManager()
