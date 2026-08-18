import {
  canonicalizeMeasurementConfig,
  createMeasurementConfigSigner,
} from "@voidhash/core/services/measurement/MeasurementConfigurationService";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

const bytes = (value: string): ArrayBuffer => {
  const decoded = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  return decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength) as ArrayBuffer;
};

describe("measurement configuration signing", () => {
  it("canonicalizes nested objects independently of insertion order", () => {
    expect(canonicalizeMeasurementConfig({ z: 1, a: { y: 2, x: 3 } })).toBe(
      canonicalizeMeasurementConfig({ a: { x: 3, y: 2 }, z: 1 }),
    );
  });

  it("creates signatures that verify and reject tampered configuration", async () => {
    const signer = await createMeasurementConfigSigner("test-key", undefined, 7);
    expect(signer.version).toBe(7);
    const payload = new TextEncoder().encode(
      canonicalizeMeasurementConfig({ projectId: "project-1", version: 1 }),
    );
    const signature = await Effect.runPromise(signer.sign(payload));
    const publicKey = await crypto.subtle.importKey(
      "spki",
      bytes(signer.publicKeySpki),
      "Ed25519",
      false,
      ["verify"],
    );
    await expect(
      crypto.subtle.verify("Ed25519", publicKey, bytes(signature), payload),
    ).resolves.toBe(true);
    await expect(
      crypto.subtle.verify(
        "Ed25519",
        publicKey,
        bytes(signature),
        new TextEncoder().encode("tampered"),
      ),
    ).resolves.toBe(false);
  });

  it("rejects invalid monotonic configuration versions", async () => {
    await expect(createMeasurementConfigSigner("test-key", undefined, 0)).rejects.toThrow(
      "positive safe integer",
    );
  });
});
