import {
	fromUnknownThrow,
	VoidhashInternalServerError,
} from "@voidhash/lib/constants";
import { Result, ok, err, Ok, Err } from "neverthrow";

/**
 * A safe way to execute a function that may throw.
 * This is a typesafe wrapper around a try-catch block.
 *
 * Cannot be named `try` as it is a reserved keyword in JS/TS.
 *
 * @example
 * const result = safeTry(() => JSON.parse('{ "a": 1 }'));
 *
 * if (result.isOk()) {
 *   console.log(result.value);
 * } else {
 *   console.error(result.error);
 * }
 *
 * // With custom error handler
 * const result2 = safeTry(
 *   () => JSON.parse('{ "a": 1 }'),
 *   (e) => new Error('Failed to parse JSON', { cause: e })
 * );
 */
export function safeTry<TOk, SpecificError>(
	fn: () => Result<TOk, SpecificError> | TOk
): Result<TOk, SpecificError | VoidhashInternalServerError>;
export function safeTry<TOk, SpecificError>(
	fn: () => Result<TOk, SpecificError> | TOk,
	errorFn: (error: unknown) => SpecificError
): Result<TOk, SpecificError>;
export function safeTry<TOk, SpecificError>(
	fn: () => Result<TOk, SpecificError> | TOk,
	errorFn?: (error: unknown) => SpecificError
): Result<TOk, SpecificError | VoidhashInternalServerError> {
	try {
		const result = fn();

		if (result instanceof Ok) {
			return ok(result.value);
		}

		if (result instanceof Err) {
			return err(result.error);
		}

		return ok(result);
	} catch (error) {
		return err(errorFn ? errorFn(error) : fromUnknownThrow(error));
	}
}

/**
 * A safe way to execute an async function that may throw or reject.
 * This is a typesafe wrapper around a try-catch block for promises.
 *
 * @example
 * const result = await safeTryPromise({
 *   try: async () => {
 *     const res = await fetch('...');
 *     if (!res.ok) throw new Error('Network response was not ok');
 *     return res.json();
 *   },
 *   catch: (e) => ({code: "INTERNAL_SERVER_ERROR", message: "Failed to fetch data", originalError: e}),
 * });
 *
 * if (result.isOk()) {
 *   console.log(result.value);
 * } else {
 *   console.error(result.error);
 * }
 */
export async function safeTryPromise<TOk, TryError>(
	fn: () => Promise<Result<TOk, TryError> | TOk>
): Promise<Result<TOk, VoidhashInternalServerError | TryError>>;
export async function safeTryPromise<TOk, TryError, SpecificError>(
	fn: () => Promise<Result<TOk, TryError> | TOk>,
	errorFn: (error: unknown) => SpecificError
): Promise<Result<TOk, SpecificError | TryError>>;
export async function safeTryPromise<TOk, TryError, SpecificError>(
	fn: () => Promise<Result<TOk, TryError> | TOk>,
	errorFn?: (error: unknown) => SpecificError
): Promise<
	Result<TOk, SpecificError | TryError | VoidhashInternalServerError>
> {
	try {
		const res = await fn();

		if (res instanceof Ok) {
			return ok(res.value);
		}

		if (res instanceof Err) {
			return err(res.error);
		}

		return ok(res);
	} catch (error) {
		return err(errorFn ? errorFn(error) : fromUnknownThrow(error));
	}
}

// class SfnError<TError> extends Error {
// 	originalError: TError;

// 	constructor(originalError: TError) {
// 		super("SfnError");
// 		this.originalError = originalError;
// 	}
// }

// type AssertFn<E> = <T>(result: Result<T, E> | E) => T;

/**
 * A utility for writing functions that use `neverthrow`'s `Result` type in a more synchronous-looking style.
 * It provides an `assert` function to unwrap `Result` objects. If an `err` is asserted, it's caught and returned as the `err` part of the resulting function's `Result`.
 * Any other thrown exceptions are caught and returned as a `VoidhashInternalServerError`.
 *
 * This is the synchronous version of `asfn`.
 *
 * @example
 * type ConcatError = { type: "missing-string" };
 *
 * function concat(a: string, b?: string): Result<string, ConcatError> {
 * 	if (!b) {
 * 		return err({ type: "missing-string" });
 * 	}
 * 	return ok(a + b);
 * }
 *
 * const safeConcat = sfn<ConcatError>()((assert) => (str1: string, str2?: string) => {
 * 	return assert(concat(str1, str2));
 * });
 *
 * const result = safeConcat("hello", " world"); // ok("hello world")
 * const result2 = safeConcat("hello"); // err({ type: "missing-string" })
 */
// export function sfn<TError>() {
// 	return function <TArgs extends unknown[], TResult>(
// 		fn: (assert: AssertFn<TError>) => (...args: TArgs) => TResult
// 	): (...args: TArgs) => Result<TResult, TError | VoidhashInternalServerError> {
// 		const assert: AssertFn<TError> = (result) => {
// 			if (result instanceof Err) {
// 				throw new SfnError(result.error);
// 			}

// 			if (result instanceof Ok) {
// 				return result.value;
// 			}

// 			throw new SfnError(result);
// 		};

// 		const innerFn = fn(assert);

// 		return (...args: TArgs) => {
// 			try {
// 				const result = innerFn(...args);
// 				if (result instanceof Err) {
// 					throw new SfnError(result.error);
// 				}
// 				return ok(result);
// 			} catch (error) {
// 				if (error instanceof SfnError) {
// 					return err(error.originalError as TError);
// 				}
// 				return err({
// 					code: "INTERNAL_SERVER_ERROR",
// 					message: "An unexpected error occurred",
// 					originalError: error,
// 				} satisfies VoidhashInternalServerError);
// 			}
// 		};
// 	};
// }

/**
 * A utility for writing async functions that use `neverthrow`'s `Result` type in a more synchronous-looking style.
 * It provides an `assert` function to unwrap `Result` objects. If an `err` is asserted, it's caught and returned as the `err` part of the resulting function's `Result`.
 * Any other thrown exceptions are caught and returned as a `VoidhashInternalServerError`.
 *
 * This is the asynchronous version of `sfn`.
 *
 * @example
 * type DivisionError = { type: "division-by-zero" };
 *
 * function divide(a: number, b: number): Result<number, DivisionError> {
 * 	if (b === 0) {
 * 		return err({ type: "division-by-zero" });
 * 	}
 * 	return ok(a / b);
 * }
 *
 * const safeDivide = asfn<DivisionError>()(
 * 	(assert) => async (num1: number, num2: number) => {
 * 		// artificial async operation
 * 		await new Promise((resolve) => setTimeout(resolve, 10));
 * 		return assert(divide(num1, num2));
 * 	}
 * );
 *
 * const result = await safeDivide(10, 2); // ok(5)
 * const result2 = await safeDivide(10, 0); // err({ type: "division-by-zero" })
 */
// export function asfn<TError>() {
// 	return function <TArgs extends unknown[], TResult>(
// 		fn: (assert: AssertFn<TError>) => (...args: TArgs) => Promise<TResult>
// 	): (
// 		...args: TArgs
// 	) => Promise<Result<TResult, TError | VoidhashInternalServerError>> {
// 		const assert: AssertFn<TError> = (result) => {
// 			if (result instanceof Err) {
// 				throw new SfnError(result.error);
// 			}

// 			if (result instanceof Ok) {
// 				return result.value;
// 			}

// 			throw new SfnError(result);
// 		};

// 		const innerFn = fn(assert);

// 		return async (...args: TArgs) => {
// 			try {
// 				const result = await innerFn(...args);
// 				if (result instanceof Err) {
// 					throw new SfnError(result.error);
// 				}
// 				return ok(result);
// 			} catch (error) {
// 				if (error instanceof SfnError) {
// 					return err(error.originalError as TError);
// 				}
// 				return err({
// 					code: "INTERNAL_SERVER_ERROR",
// 					message: "An unexpected error occurred",
// 					originalError: error,
// 				} satisfies VoidhashInternalServerError);
// 			}
// 		};
// 	};
// }
