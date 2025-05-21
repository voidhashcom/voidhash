import { z } from "zod";

const ErrorCode = z.enum([
	"BAD_REQUEST",
	"FORBIDDEN",
	"INTERNAL_SERVER_ERROR",
	"USAGE_EXCEEDED",
	"DISABLED",
	"NOT_FOUND",
	"CONFLICT",
	"RATE_LIMITED",
	"UNAUTHORIZED",
]);

export class VoidhashHTTPError extends Error {
	public code: z.infer<typeof ErrorCode>;
	public originalError: Error | null;

	constructor({
		code,
		message,
		originalError,
	}: {
		code: z.infer<typeof ErrorCode>;
		message: string;
		originalError?: any;
	}) {
		super(message);
		this.name = `VoidhashError:${code}`;
		this.message = `${message}`;
		this.code = code;
		this.originalError = originalError || null;
	}
}

export function isVoidhashError(error: Error) {
	return error.message.startsWith("VoidhashError:");
}

export function parseVoidhashError(error: Error) {
	const message = error.message.split(":")[1];
	return message;
}

export type VoidhashBadRequestError = {
	code: "BAD_REQUEST";
	message: string;
	validationErrors?: z.ZodError;
};

export type VoidhashForbiddenError = {
	code: "FORBIDDEN";
	message: string;
};

export type VoidhashInternalServerError = {
	code: "INTERNAL_SERVER_ERROR";
	message: string;
	originalError: Error;
};

export type VoidhashUsageExceededError = {
	code: "USAGE_EXCEEDED";
	message: string;
};

export type VoidhashDisabledError = {
	code: "DISABLED";
	message: string;
};

export type VoidhashNotFoundError = {
	code: "NOT_FOUND";
	message: string;
	resource: string;
	payload: any;
};

export type VoidhashConflictError = {
	code: "CONFLICT";
	message: string;
	resource: string;
	payload: any;
};

export type VoidhashRateLimitedError = {
	code: "RATE_LIMITED";
	message: string;
	resource: string;
	payload: any;
};

export type VoidhashUnauthorizedError = {
	code: "UNAUTHORIZED";
	message: string;
};

export type AnyVoidhashError =
	| VoidhashBadRequestError
	| VoidhashForbiddenError
	| VoidhashInternalServerError
	| VoidhashUsageExceededError
	| VoidhashDisabledError
	| VoidhashNotFoundError
	| VoidhashConflictError
	| VoidhashRateLimitedError
	| VoidhashUnauthorizedError;

export function fromUnknownThrow(error: unknown): VoidhashInternalServerError {
	if (error instanceof Error) {
		return {
			code: "INTERNAL_SERVER_ERROR",
			message: error.message,
			originalError: error,
		};
	}

	if (typeof error === "string") {
		return {
			code: "INTERNAL_SERVER_ERROR",
			message: error,
			originalError: new Error(error),
		};
	}

	return {
		code: "INTERNAL_SERVER_ERROR",
		message: "Unknown error",
		originalError: new Error("Unknown error"),
	};
}

export function toVoidhashHTTPError(
	error: AnyVoidhashError
): VoidhashHTTPError {
	let originalError = null;
	switch (error.code) {
		case "BAD_REQUEST":
			originalError = error.validationErrors;
			break;
		case "INTERNAL_SERVER_ERROR":
			originalError = error.originalError;
			break;
		default:
			originalError = null;
	}

	return new VoidhashHTTPError({
		code: error.code,
		message: error.message,
		originalError: originalError,
	});
}
