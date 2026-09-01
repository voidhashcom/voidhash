import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";

const encodeJson = Schema.encodeSync(Schema.UnknownFromJsonString);

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
  timestamp: DateTime.Utc;
  context?: string;
  data?: unknown;
}

export interface LogHandler {
  handle(entry: LogEntry): Effect.Effect<void>;
}

export class ConsoleLogHandler implements LogHandler {
  handle(entry: LogEntry): Effect.Effect<void> {
    const timestamp = DateTime.formatIso(entry.timestamp);
    const context = entry.context ? ` [${entry.context}]` : "";
    const data = entry.data ? ` ${encodeJson(entry.data)}` : "";
    const logMessage = `[${timestamp}]${context}: ${entry.message}${data}`;
    return Match.value(entry.level).pipe(
      Match.when(LogLevel.DEBUG, () => Effect.logDebug(logMessage)),
      Match.when(LogLevel.INFO, () => Effect.logInfo(logMessage)),
      Match.when(LogLevel.WARN, () => Effect.logWarning(logMessage)),
      Match.when(LogLevel.ERROR, () => Effect.logError(logMessage)),
      Match.orElse(() => Effect.void),
    );
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

  private log(level: LogLevel, message: string, data?: unknown): Effect.Effect<void> {
    if (!this.shouldLog(level)) {
      return Effect.void;
    }
    return Effect.gen({ self: this }, function* log() {
      const entry: LogEntry = {
        context: this.context,
        data,
        level,
        message,
        timestamp: yield* DateTime.now,
      };
      yield* Effect.forEach(this.handlers, (handler) => handler.handle(entry), {
        concurrency: 1,
        discard: true,
      });
    });
  }

  debug(message: string, data?: unknown): Effect.Effect<void> {
    return this.log(LogLevel.DEBUG, message, data);
  }

  info(message: string, data?: unknown): Effect.Effect<void> {
    return this.log(LogLevel.INFO, message, data);
  }

  warn(message: string, data?: unknown): Effect.Effect<void> {
    return this.log(LogLevel.WARN, message, data);
  }

  error(message: string, data?: unknown): Effect.Effect<void> {
    return this.log(LogLevel.ERROR, message, data);
  }

  // Convenience method for logging errors with stack traces
  errorWithStack(
    message: string,
    error: Error,
    data?: Record<string, unknown>,
  ): Effect.Effect<void> {
    return this.log(LogLevel.ERROR, message, {
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
    this.handlers.forEach((handler) => childLogger.addHandler(handler));

    return childLogger;
  }
}
