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
	"PRECONDITION_FAILED",
	"INSUFFICIENT_PERMISSIONS",
	"METHOD_NOT_ALLOWED",
	"EXPIRED",
	"DELETE_PROTECTED",
]);

export class VoidhashError extends Error {
	public code: z.infer<typeof ErrorCode>;
	constructor({
		code,
		message,
	}: {
		code: z.infer<typeof ErrorCode>;
		message: string;
	}) {
		super(message);
		this.name = "VoidhashError";
		this.message = `${message}`;
		this.code = code;
	}
}

// export class BadRequestError extends VoidhashError {
// 	constructor(message: string) {
// 		super({ code: "BAD_REQUEST", message });
// 		this.name = "BadRequestError";
// 	}
// }

// export class NotFoundError extends VoidhashError {
// 	constructor(message: string) {
// 		super({ code: "NOT_FOUND", message });
// 		this.name = "NotFoundError";
// 	}
// }

// export class UnauthorizedError extends VoidhashError {
// 	constructor(message: string) {
// 		super({ code: "UNAUTHORIZED", message });
// 		this.name = "UnauthorizedError";
// 	}
// }

// export class ConflictError extends VoidhashError {
// 	constructor(message: string) {
// 		super({ code: "CONFLICT", message });
// 		this.name = "ConflictError";
// 	}
// }

export function isVoidhashError(error: Error) {
	return error.message.startsWith("VoidhashError:");
}

export function parseVoidhashError(error: Error) {
	const message = error.message.split(":")[1];
	return message;
}
