export class VoidhashError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "VoidhashError";
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
