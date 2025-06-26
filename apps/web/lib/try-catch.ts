import { AnyVoidhashError, fromUnknownThrow } from "@voidhash/lib/constants";

// Types for the result object with discriminated union
type Success<T> = {
	data: T;
	error: null;
};

type Failure = {
	data: null;
	error: AnyVoidhashError;
};

type Result<T> = Success<T> | Failure;

// Main wrapper function
export async function tryCatch<T>(promise: Promise<T>): Promise<Result<T>> {
	try {
		const data = await promise;
		return { data, error: null };
	} catch (error) {
		const unknownError = fromUnknownThrow(error);
		return {
			data: null,
			error: {
				code: unknownError.code as string,
				message: unknownError.message,
			} as AnyVoidhashError,
		};
	}
}
