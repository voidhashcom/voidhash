export class VoidhashError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "VoidhashError";
		this.message = `VoidhashError:${message}`;
	}
}

export class BadRequestError extends VoidhashError {
	constructor(message: string) {
		super(message);
		this.name = "BadRequestError";
	}
}

export class NotFoundError extends VoidhashError {
	constructor(message: string) {
		super(message);
		this.name = "NotFoundError";
	}
}

export class UnauthorizedError extends VoidhashError {
	constructor(message: string) {
		super(message);
		this.name = "UnauthorizedError";
	}
}

export class ConflictError extends VoidhashError {
	constructor(message: string) {
		super(message);
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
