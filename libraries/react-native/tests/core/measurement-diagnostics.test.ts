import { describe, expect, it } from "vitest";

import {
  encodeDiagnosticAuthorizationPayload,
  SecureDiagnosticLogger,
  type DiagnosticAuthorization,
  type RedactedDiagnosticEntry,
} from "../../src/core/measurement/diagnostics";

const base64 = (bytes: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));

describe("secure measurement diagnostics", () => {
  it("forces release logging off until a valid signed session is active and always redacts", async () => {
    const key = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]);
    const entries: RedactedDiagnosticEntry[] = [];
    let now = new Date("2026-01-01T00:00:00.000Z");
    const logger = new SecureDiagnosticLogger(
      "project-1",
      new Map([["support-1", key.publicKey]]),
      true,
      (entry) => entries.push(entry),
      () => now,
    );
    expect(logger.log("debug", "hidden", { safe: true })).toBe(false);
    const unsigned = {
      expiresAt: "2026-01-01T01:00:00.000Z",
      keyId: "support-1",
      projectId: "project-1",
      sessionId: "diagnostic-1",
    };
    const signature = await crypto.subtle.sign(
      "Ed25519",
      key.privateKey,
      encodeDiagnosticAuthorizationPayload(unsigned),
    );
    const authorization: DiagnosticAuthorization = { ...unsigned, signature: base64(signature) };
    await expect(logger.authorize({ ...authorization, projectId: "wrong" })).resolves.toBe(false);
    await expect(logger.authorize(authorization)).resolves.toBe(true);
    expect(logger.log("debug", "request to https://private.example/path", {
      nested: { email: "person@example.com", safe: "retained" },
      pushToken: "private-token",
    })).toBe(true);
    expect(entries).toEqual([expect.objectContaining({
      fields: { nested: { email: "[redacted]", safe: "retained" }, pushToken: "[redacted]" },
      message: "request to [redacted]",
    })]);
    now = new Date("2026-01-01T01:00:00.000Z");
    expect(logger.log("debug", "expired")).toBe(false);
  });

  it("allows debug-build logging but still redacts protected material", () => {
    const entries: RedactedDiagnosticEntry[] = [];
    const logger = new SecureDiagnosticLogger("project-1", new Map(), false, (entry) => entries.push(entry));
    expect(logger.log("info", "token=secret", { url: "https://private.example" })).toBe(true);
    expect(entries[0]).toMatchObject({ fields: { url: "[redacted]" }, message: "[redacted]" });
  });
});
