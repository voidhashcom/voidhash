export type AppErrorCode =
  | "CONFIG_ERROR"
  | "AUTH_ERROR"
  | "API_ERROR"
  | "WS_ERROR"
  | "NO_ACTIVE_SESSION"
  | "VALIDATION_ERROR";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly details?: unknown;

  constructor(code: AppErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export const normalizeUnknownError = (error: unknown): Record<string, unknown> => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
    };
  }

  if (typeof error === "object" && error !== null) {
    return error as Record<string, unknown>;
  }

  return { value: error };
};

export const toAppError = (
  error: unknown,
  fallbackCode: AppErrorCode,
  fallbackMessage: string,
): AppError => {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError(fallbackCode, fallbackMessage, normalizeUnknownError(error));
};
