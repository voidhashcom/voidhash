import { describe, it, expect } from "vitest";
import { safeTry, safeTryPromise } from "./neverthrow";
import { err, ok } from "neverthrow";

// Tests for safeTry
describe("safeTry", () => {
	it("should return Ok result when try function succeeds", () => {
		const result = safeTry(() => "success");
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toBe("success");
		}
	});

	it("should return Err result when try function throws", () => {
		const error = new Error("test error");
		const result = safeTry(() => {
			throw error;
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
		const result = await safeTryPromise(async () => ok("success"));
		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toBe("success");
		}
	});

	it("should return Err result when promise resolves with Err", async () => {
		const result = await safeTryPromise(async () => err("try error"));
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBe("try error");
		}
	});

	it("should return Err result from catch when promise throws", async () => {
		const error = new Error("test error");
		const result = await safeTryPromise(async () => {
			throw error;
		});
		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBe("test error");
		}
	});
});
