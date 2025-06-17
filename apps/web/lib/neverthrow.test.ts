import { describe, it, expect } from "vitest";
import { safeTry, safeTryPromise, sfn, asfn } from "./neverthrow";
import { err, ok, Result } from "neverthrow";
import type { VoidhashInternalServerError } from "@voidhash/lib/constants";

// Tests for safeTry
describe("safeTry", () => {
	it("should return Ok result when try function succeeds", () => {
		const result = safeTry({
			try: () => "success",
			catch: () => "error",
		});
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toBe("success");
		}
	});

	it("should return Err result when try function throws", () => {
		const error = new Error("test error");
		const result = safeTry({
			try: () => {
				throw error;
			},
			catch: (e) => (e instanceof Error ? e.message : "unknown error"),
		});
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBe("test error");
		}
	});
});

// Tests for safeTryPromise
describe("safeTryPromise", () => {
	it("should return Ok result when promise resolves with Ok", async () => {
		const result = await safeTryPromise({
			try: async () => ok("success"),
			catch: () => "error",
		});
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toBe("success");
		}
	});

	it("should return Err result when promise resolves with Err", async () => {
		const result = await safeTryPromise({
			try: async () => err("try error"),
			catch: () => "catch error",
		});
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBe("try error");
		}
	});

	it("should return Err result from catch when promise throws", async () => {
		const error = new Error("test error");
		const result = await safeTryPromise({
			try: async () => {
				throw error;
			},
			catch: (e) => (e instanceof Error ? e.message : "unknown error"),
		});
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBe("test error");
		}
	});
});

// Tests for sfn
describe("sfn", () => {
	type TestError = { type: "test-error" };
	const testError: TestError = { type: "test-error" };

	function fallibleOp(shouldFail: boolean): Result<string, TestError> {
		if (shouldFail) {
			return err(testError);
		}
		return ok("success");
	}

	it("should return Ok when no error is asserted", () => {
		const safeFn = sfn<TestError>()((assert) => () => {
			const value = assert(fallibleOp(false));
			return `The value is ${value}`;
		});
		const result = safeFn();
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toBe("The value is success");
		}
	});

	it("should return Err when an error is asserted", () => {
		const safeFn = sfn<TestError>()((assert) => () => {
			const value = assert(fallibleOp(true));
			return `The value is ${value}`;
		});
		const result = safeFn();
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toEqual(testError);
		}
	});

	it("should return VoidhashInternalServerError on unexpected throw", () => {
		const unexpectedError = new Error("unexpected");
		const safeFn = sfn<TestError>()(() => () => {
			if (true) {
				// to make it always throw for the test
				throw unexpectedError;
			}
			return "unreachable";
		});
		const result = safeFn();
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			const error = result.error as VoidhashInternalServerError;
			expect(error.code).toBe("INTERNAL_SERVER_ERROR");
			expect(error.originalError).toBe(unexpectedError);
		}
	});
});

// Tests for asfn
describe("asfn", () => {
	type TestError = { type: "test-error" };
	const testError: TestError = { type: "test-error" };

	function fallibleOp(shouldFail: boolean): Result<string, TestError> {
		if (shouldFail) {
			return err(testError);
		}
		return ok("success");
	}

	it("should return Ok when no error is asserted", async () => {
		const safeFn = asfn<TestError>()((assert) => async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			const value = assert(fallibleOp(false));
			return `The value is ${value}`;
		});
		const result = await safeFn();
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toBe("The value is success");
		}
	});

	it("should return Err when an error is asserted", async () => {
		const safeFn = asfn<TestError>()((assert) => async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			const value = assert(fallibleOp(true));
			return `The value is ${value}`;
		});
		const result = await safeFn();
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toEqual(testError);
		}
	});

	it("should return VoidhashInternalServerError on unexpected throw", async () => {
		const unexpectedError = new Error("unexpected");
		const safeFn = asfn<TestError>()(() => async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			if (true) {
				throw unexpectedError;
			}
			return "unreachable";
		});
		const result = await safeFn();
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			const error = result.error as VoidhashInternalServerError;
			expect(error.code).toBe("INTERNAL_SERVER_ERROR");
			expect(error.originalError).toBe(unexpectedError);
		}
	});
});
