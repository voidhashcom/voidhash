import { Result, ok, err } from "neverthrow";

type TryOptions<Ok, SpecificError> = {
	try: () => Ok;
	catch: (error: unknown) => SpecificError;
};

/**
 * A safe way to execute a function that may throw.
 * This is a typesafe wrapper around a try-catch block.
 *
 * Cannot be named `try` as it is a reserved keyword in JS/TS.
 *
 * @example
 * const result = safeTry({
 *   try: () => JSON.parse('{ "a": 1 }'),
 *   catch: (e) => new Error('Failed to parse JSON', { cause: e }),
 * });
 *
 * if (result.isOk()) {
 *   console.log(result.value);
 * } else {
 *   console.error(result.error);
 * }
 */
export function safeTry<Ok, SpecificError>({
	try: fn,
	catch: errorFn,
}: TryOptions<Ok, SpecificError>): Result<Ok, SpecificError> {
	return Result.fromThrowable(fn, errorFn)();
}

type TryPromiseOptions<Ok, TryError, SpecificError> = {
	try: () => Promise<Result<Ok, TryError>>;
	catch: (error: unknown) => SpecificError;
};

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
 *   catch: (e) => new Error('Failed to fetch data', { cause: e }),
 * });
 *
 * if (result.isOk()) {
 *   console.log(result.value);
 * } else {
 *   console.error(result.error);
 * }
 */
export async function safeTryPromise<Ok, TryError, SpecificError>({
	try: fn,
	catch: errorFn,
}: TryPromiseOptions<Ok, TryError, SpecificError>): Promise<
	Result<Ok, SpecificError | TryError>
> {
	try {
		const res = await fn();
		if (res.isErr()) {
			return err(res.error);
		}
		return ok(res.value);
	} catch (error) {
		return err(errorFn(error));
	}
}
