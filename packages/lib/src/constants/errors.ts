export class VoidhashError extends Error {
	public code: number;
	constructor(message: string, code: number) {
		super(message);
		this.name = "VoidhashError";
		this.message = `${message}`;
		this.code = code;
	}
}

export class BadRequestError extends VoidhashError {
	constructor(message: string) {
		super(message, 400);
		this.name = "BadRequestError";
	}
}

export class NotFoundError extends VoidhashError {
	constructor(message: string) {
		super(message, 404);
		this.name = "NotFoundError";
	}
}

export class UnauthorizedError extends VoidhashError {
	constructor(message: string) {
		super(message, 401);
		this.name = "UnauthorizedError";
	}
}

export class ConflictError extends VoidhashError {
	constructor(message: string) {
		super(message, 409);
		this.name = "ConflictError";
	}
}

export function isVoidhashError(error: Error) {
	return error.message.startsWith("VoidhashError:");
}

export function parseVoidhashError(error: Error) {
	const message = error.message.split(":")[1];
	return message;
}
