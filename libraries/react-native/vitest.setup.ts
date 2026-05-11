import { randomUUID } from "node:crypto";
import { ServiceMap } from "effect";
import { expect } from "vitest";

expect.addEqualityTesters([]);

if (typeof globalThis.crypto !== "object") {
	Object.defineProperty(globalThis, "crypto", {
		value: {},
		writable: true,
	});
}

if (typeof globalThis.crypto.randomUUID !== "function") {
	Object.defineProperty(globalThis.crypto, "randomUUID", {
		value: randomUUID,
		writable: true,
	});
}

/**
 * Effect v4 (effect-smol) no longer treats `ServiceMap.Service` classes as
 * effects directly - they're `Yieldable` and must be unwrapped via
 * `Service.asEffect()` or `yield* Service` before use in operators like
 * `Effect.flatMap`. The fiber runtime checks for an `evaluate` symbol on the
 * value it's stepping through and throws "Not a valid effect" otherwise.
 *
 * This codebase's tests still use the v3-era `Effect.flatMap(Service, fn)`
 * pattern. Rather than touch every call site, we patch `ServiceProto` so a
 * `Service` evaluates as its underlying effect - restoring the old behavior in
 * tests only. Production code uses the `yield* Service` syntax and is
 * unaffected.
 */
{
	const evaluateKey = "~effect/Effect/evaluate";
	class DummyService extends ServiceMap.Service<
		DummyService,
		Record<string, unknown>
	>()("__voidhash/VitestPolyfillProbe__") {}
	const ServiceProto = Object.getPrototypeOf(Object.getPrototypeOf(DummyService));
	if (ServiceProto && !(evaluateKey in ServiceProto)) {
		Object.defineProperty(ServiceProto, evaluateKey, {
			configurable: true,
			writable: true,
			value(this: { asEffect: () => Record<string, unknown> }, fiber: unknown) {
				const effect = this.asEffect();
				return (
					effect as Record<string, (fiber: unknown) => unknown>
				)[evaluateKey](fiber);
			},
		});
	}
}
