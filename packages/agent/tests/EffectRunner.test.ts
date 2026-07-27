import { Context, Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";

import { makeLayerEffectRunner } from "../src/EffectRunner.ts";

class Lease extends Context.Service<Lease, { readonly id: number; readonly use: () => number }>()(
  "test/Lease",
) {}

describe("makeLayerEffectRunner", () => {
  it("acquires and releases a fresh scoped layer for every execution", async () => {
    let nextId = 0;
    const released = new Set<number>();
    const runner = makeLayerEffectRunner<void, Lease>(() =>
      Layer.effect(
        Lease,
        Effect.acquireRelease(
          Effect.sync(() => {
            const id = ++nextId;
            return {
              id,
              use: () => {
                if (released.has(id)) throw new Error(`lease ${id} was already released`);
                return id;
              },
            };
          }),
          (lease) => Effect.sync(() => released.add(lease.id)),
        ),
      ),
    );
    const useLease = Effect.gen(function* () {
      const lease = yield* Lease;
      return lease.use();
    });

    await expect(runner(undefined, useLease)).resolves.toBe(1);
    expect(released).toEqual(new Set([1]));
    await expect(runner(undefined, useLease)).resolves.toBe(2);
    expect(released).toEqual(new Set([1, 2]));
  });
});
