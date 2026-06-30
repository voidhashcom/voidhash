export const LogLevel = {
  DEBUG: 0,
  ERROR: 3,
  INFO: 1,
  NONE: 4,
  WARN: 2,
} as const;

export type LogLevel = (typeof LogLevel)[keyof typeof LogLevel];

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: string;
  data?: unknown;
}

export interface LogHandler {
  handle(entry: LogEntry): void;
}

export class ConsoleLogHandler implements LogHandler {
  private getLevelString(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: {
        return "DEBUG";
      }
      case LogLevel.INFO: {
        return "INFO";
      }
      case LogLevel.WARN: {
        return "WARN";
      }
      case LogLevel.ERROR: {
        return "ERROR";
      }
      default: {
        return "UNKNOWN";
      }
    }
  }

  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG: {
        return "\u001B[36m";
      } // Cyan
      case LogLevel.INFO: {
        return "\u001B[32m";
      } // Green
      case LogLevel.WARN: {
        return "\u001B[33m";
      } // Yellow
      case LogLevel.ERROR: {
        return "\u001B[31m";
      } // Red
      default: {
        return "\u001B[0m";
      } // Reset
    }
  }

  handle(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelString = this.getLevelString(entry.level);
    const color = this.getLevelColor(entry.level);
    const reset = "\u001B[0m";

    const context = entry.context ? ` [${entry.context}]` : "";
    const data = entry.data ? ` ${JSON.stringify(entry.data, null, 2)}` : "";

    const logMessage = `${color}[${timestamp}] ${levelString}${context}: ${entry.message}${data}${reset}`;

    switch (entry.level) {
      case LogLevel.DEBUG: {
        // biome-ignore lint/suspicious/noConsole: It is a console logger
        console.debug(logMessage);
        break;
      }
      case LogLevel.INFO: {
        // biome-ignore lint/suspicious/noConsole: It is a console logger
        console.info(logMessage);
        break;
      }
      case LogLevel.WARN: {
        // biome-ignore lint/suspicious/noConsole: It is a console logger
        console.warn(logMessage);
        break;
      }
      case LogLevel.ERROR: {
        // biome-ignore lint/suspicious/noConsole: It is a console logger
        console.error(logMessage);
        break;
      }
      default: {
        // biome-ignore lint/suspicious/noConsole: It is a console logger
        console.log(logMessage);
      }
    }
  }
}

export class Logger {
  private handlers: LogHandler[] = [];
  private level: LogLevel = LogLevel.INFO;
  private context?: string;

  constructor(context?: string, level: LogLevel = LogLevel.INFO) {
    this.context = context;
    this.level = level;

    // Add default console handler
    this.addHandler(new ConsoleLogHandler());
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  addHandler(handler: LogHandler): void {
    this.handlers.push(handler);
  }

  removeHandler(handler: LogHandler): void {
    const index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }
  }

  clearHandlers(): void {
    this.handlers = [];
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      context: this.context,
      data,
      level,
      message,
      timestamp: new Date(),
    };

    for (const handler of this.handlers) {
      try {
        handler.handle(entry);
      } catch (error) {
        // biome-ignore lint/suspicious/noConsole: It is a console logger
        console.error("Logger handler error:", error);
      }
    }
  }

  debug(message: string, data?: unknown): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): void {
    this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown): void {
    this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: unknown): void {
    this.log(LogLevel.ERROR, message, data);
  }

  // Convenience method for logging errors with stack traces
  errorWithStack(message: string, error: Error, data?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, {
      ...data,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
    });
  }

  // Create a child logger with additional context
  child(additionalContext: string): Logger {
    const childLogger = new Logger(
      this.context ? `${this.context}.${additionalContext}` : additionalContext,
      this.level,
    );

    // Copy handlers from parent
    for (const handler of this.handlers) {
      childLogger.addHandler(handler);
    }

    return childLogger;
  }
}
