import { Data } from "effect";

export class UnauthenticatedError extends Data.TaggedError(
	"UnauthenticatedError"
)<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class ForbiddenError extends Data.TaggedError("ForbiddenError")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<{
	readonly cause?: unknown;
	readonly message: string;
}> {}
