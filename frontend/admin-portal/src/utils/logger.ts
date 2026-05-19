/**
 * 前端日志工具类
 * 统一管理前端日志，支持日志级别、本地存储、远程上报等功能
 */

export const LogLevel = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
} as const;

export type LogLevel = typeof LogLevel[keyof typeof LogLevel];

interface LogEntry {
  timestamp: string;
  level: string;
  context?: string;
  message: string;
  data?: any;
  stack?: string;
}

class Logger {
  private logLevel: LogLevel;
  private logs: LogEntry[] = [];
  private maxLogs = 1000; // 内存中最多保存的日志数量
  private enableLocalStorage = true;
  private enableRemoteLogging = false;
  private remoteLoggingEndpoint?: string;

  constructor() {
    // 从环境变量或 localStorage 读取日志级别
    const envLogLevel = import.meta.env.VITE_LOG_LEVEL?.toUpperCase() || 'INFO';
    const levelMap: Record<string, LogLevel> = {
      ERROR: LogLevel.ERROR,
      WARN: LogLevel.WARN,
      INFO: LogLevel.INFO,
      DEBUG: LogLevel.DEBUG,
    };
    this.logLevel = levelMap[envLogLevel] ?? LogLevel.INFO;

    // 从 localStorage 读取配置
    const storedConfig = localStorage.getItem('logger_config');
    if (storedConfig) {
      try {
        const config = JSON.parse(storedConfig);
        this.enableLocalStorage = config.enableLocalStorage ?? true;
        this.enableRemoteLogging = config.enableRemoteLogging ?? false;
        this.remoteLoggingEndpoint = config.remoteLoggingEndpoint;
      } catch (e) {
        console.warn('Failed to parse logger config from localStorage', e);
      }
    }

    // 定期清理旧日志
    setInterval(() => {
      this.cleanOldLogs();
    }, 60000); // 每分钟清理一次
  }

  private formatTimestamp(): string {
    const now = new Date();
    return now.toISOString();
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.logLevel;
  }

  private addLog(level: string, context: string | undefined, message: string, data?: any, stack?: string) {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(),
      level,
      context,
      message,
      data,
      stack,
    };

    this.logs.push(entry);

    // 限制内存中的日志数量
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // 保存到 localStorage
    if (this.enableLocalStorage) {
      this.saveToLocalStorage(entry);
    }

    // 远程上报（仅错误和警告）
    if (this.enableRemoteLogging && (level === 'ERROR' || level === 'WARN')) {
      this.sendToRemote(entry);
    }
  }

  private saveToLocalStorage(entry: LogEntry) {
    try {
      const key = `app_logs_${new Date().toISOString().split('T')[0]}`;
      const existingLogs = localStorage.getItem(key);
      const logs = existingLogs ? JSON.parse(existingLogs) : [];
      logs.push(entry);
      
      // 只保留最近7天的日志
      if (logs.length > 10000) {
        logs.splice(0, logs.length - 10000);
      }
      
      localStorage.setItem(key, JSON.stringify(logs));
    } catch (e) {
      // localStorage 可能已满，忽略错误
      console.warn('Failed to save log to localStorage', e);
    }
  }

  private async sendToRemote(entry: LogEntry) {
    if (!this.remoteLoggingEndpoint) return;

    try {
      await fetch(this.remoteLoggingEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry),
        keepalive: true, // 使用 keepalive 确保请求在页面关闭时也能发送
      });
    } catch (e) {
      // 静默失败，避免日志上报本身产生错误
      console.warn('Failed to send log to remote', e);
    }
  }

  private cleanOldLogs() {
    // 清理7天前的 localStorage 日志
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('app_logs_')) {
        const dateStr = key.replace('app_logs_', '');
        const logDate = new Date(dateStr);
        if (logDate < sevenDaysAgo) {
          localStorage.removeItem(key);
        }
      }
    }
  }

  error(message: string, error?: Error | any, context?: string) {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const errorData = error instanceof Error 
      ? { message: error.message, name: error.name }
      : error;
    const stack = error instanceof Error ? error.stack : undefined;

    console.error(`[${context || 'App'}] ${message}`, error || '');
    this.addLog('ERROR', context, message, errorData, stack);
  }

  warn(message: string, data?: any, context?: string) {
    if (!this.shouldLog(LogLevel.WARN)) return;

    console.warn(`[${context || 'App'}] ${message}`, data || '');
    this.addLog('WARN', context, message, data);
  }

  info(message: string, data?: any, context?: string) {
    if (!this.shouldLog(LogLevel.INFO)) return;

    console.log(`[${context || 'App'}] ${message}`, data || '');
    this.addLog('INFO', context, message, data);
  }

  debug(message: string, data?: any, context?: string) {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    if (import.meta.env.DEV) {
      console.debug(`[${context || 'App'}] ${message}`, data || '');
    }
    this.addLog('DEBUG', context, message, data);
  }

  getLogs(level?: string, limit?: number): LogEntry[] {
    let filtered = this.logs;
    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }
    if (limit) {
      filtered = filtered.slice(-limit);
    }
    return filtered;
  }

  clearLogs() {
    this.logs = [];
  }

  setLogLevel(level: LogLevel) {
    this.logLevel = level;
  }

  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  configure(config: {
    enableLocalStorage?: boolean;
    enableRemoteLogging?: boolean;
    remoteLoggingEndpoint?: string;
  }) {
    if (config.enableLocalStorage !== undefined) {
      this.enableLocalStorage = config.enableLocalStorage;
    }
    if (config.enableRemoteLogging !== undefined) {
      this.enableRemoteLogging = config.enableRemoteLogging;
    }
    if (config.remoteLoggingEndpoint !== undefined) {
      this.remoteLoggingEndpoint = config.remoteLoggingEndpoint;
    }

    // 保存配置到 localStorage
    localStorage.setItem('logger_config', JSON.stringify({
      enableLocalStorage: this.enableLocalStorage,
      enableRemoteLogging: this.enableRemoteLogging,
      remoteLoggingEndpoint: this.remoteLoggingEndpoint,
    }));
  }
}

// 导出单例
export const logger = new Logger();

// 导出便捷方法
export const logError = (message: string, error?: Error | any, context?: string) => {
  logger.error(message, error, context);
};

export const logWarn = (message: string, data?: any, context?: string) => {
  logger.warn(message, data, context);
};

export const logInfo = (message: string, data?: any, context?: string) => {
  logger.info(message, data, context);
};

export const logDebug = (message: string, data?: any, context?: string) => {
  logger.debug(message, data, context);
};

