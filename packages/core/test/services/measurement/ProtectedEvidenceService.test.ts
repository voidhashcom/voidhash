import { CaptureInvalidRequestError, CapturePayloadTooLargeError } from "@voidhash/api-contracts/event-capture";
import { decodeProtectedCiphertext } from "@voidhash/core/services/measurement/ProtectedEvidenceService";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("decodeProtectedCiphertext", () => {
  it("decodes canonical base64 without changing ciphertext bytes", async () => {
    const result = await Effect.runPromise(decodeProtectedCiphertext("AAECA/7/"));
    expect([...result]).toEqual([0, 1, 2, 3, 254, 255]);
  });

  it.each(["not base64", "YWJjZA", "YWJjZA===", "YWJjZA==\n"])(
    "rejects non-canonical input %j",
    async (input) => {
      const error = await Effect.runPromise(Effect.flip(decodeProtectedCiphertext(input)));
      expect(error).toBeInstanceOf(CaptureInvalidRequestError);
    },
  );

  it("rejects ciphertext beyond the protected-vault transport bound", async () => {
    const input = Buffer.alloc(512 * 1024 + 1, 7).toString("base64");
    const error = await Effect.runPromise(Effect.flip(decodeProtectedCiphertext(input)));
    expect(error).toBeInstanceOf(CapturePayloadTooLargeError);
  });
});
