import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { MimicSDK, RawCollectionHandle } from "@voidhash/mimic-server/effect";

/**
 * Unit coverage for `RawCollectionHandle.submitTransaction` — the granular
 * server-write path the paywall workspace uses (distinct from the whole-value
 * `setDocumentRaw`). We drive the handle against a fake `MimicSDK` whose
 * `runEffect` invokes the caller's function with a stub `SubmitTransaction`,
 * capturing the transaction envelope the handle builds. This asserts the wire
 * shape and the (deliberately non-dying) result pass-through without standing up
 * an HTTP protocol — the full over-the-wire round-trip is exercised by the
 * mimic-db integration suite.
 */

interface SubmitCall {
  readonly collectionId: string;
  readonly documentId: string;
  readonly transaction: {
    readonly id: string;
    readonly baseVersion: number;
    readonly commands: readonly unknown[];
  };
}

/** A fake SDK: `runEffect(fn)` runs `fn` with a stub client capturing the submit. */
const fakeSdk = (
  calls: SubmitCall[],
  response: { accepted: boolean; version: number; transactionId?: string; reason?: string },
): MimicSDK => {
  const client = {
    SubmitTransaction: (payload: SubmitCall) =>
      Effect.sync(() => {
        calls.push(payload);
        return {
          accepted: response.accepted,
          version: response.version,
          transactionId: response.transactionId ?? payload.transaction.id,
          reason: response.reason,
        };
      }),
  };
  const sdk: MimicSDK = Object.create(MimicSDK.prototype);
  Object.defineProperty(sdk, "runEffect", {
    value: (fn: (c: typeof client) => Effect.Effect<unknown, unknown>) => fn(client),
  });
  return sdk;
};

describe("RawCollectionHandle.submitTransaction", () => {
  it("builds a granular envelope (no whole-value command) at the given baseVersion", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const calls: SubmitCall[] = [];
        const handle = new RawCollectionHandle(
          "col-1",
          "db-1",
          fakeSdk(calls, { accepted: true, version: 12 }),
        );

        const commands = [
          { kind: "object.set", path: [], key: "source", value: { kind: "string", value: "x" } },
        ];
        const result = yield* handle.submitTransaction("doc-1", {
          baseVersion: 11,
          commands,
          id: "tx-1",
        });

        expect(result).toEqual({
          accepted: true,
          version: 12,
          transactionId: "tx-1",
          reason: undefined,
        });
        expect(calls).toHaveLength(1);
        const call = calls[0]!;
        expect(call).toEqual({
          collectionId: "col-1",
          documentId: "doc-1",
          transaction: { id: "tx-1", baseVersion: 11, commands },
        });
        // Crucially NOT a whole-value replace — the batch is exactly the caller's.
        expect(call.transaction.commands).toBe(commands);
      }),
    ));

  it("returns a rejected result verbatim instead of dying (caller retries)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const calls: SubmitCall[] = [];
        const handle = new RawCollectionHandle(
          "col-1",
          "db-1",
          fakeSdk(calls, {
            accepted: false,
            version: 20,
            reason: "Version conflict: expected 20, received 11",
          }),
        );

        const result = yield* handle.submitTransaction("doc-1", {
          baseVersion: 11,
          commands: [],
          id: "tx-2",
        });

        expect(result.accepted).toBe(false);
        expect(result.version).toBe(20);
        expect(result.reason).toContain("Version conflict");
      }),
    ));

  it("mints a transaction id when none is supplied", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const calls: SubmitCall[] = [];
        const handle = new RawCollectionHandle(
          "col-1",
          "db-1",
          fakeSdk(calls, { accepted: true, version: 2 }),
        );

        yield* handle.submitTransaction("doc-1", { baseVersion: 1, commands: [] });
        expect(calls[0]!.transaction.id.length).toBeGreaterThan(0);
      }),
    ));
});
