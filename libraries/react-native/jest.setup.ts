// oxlint-disable-next-line effect/noNodeBuiltinImport -- test-environment polyfill: installs `randomUUID` on `globalThis.crypto` before any test or Effect runtime exists, so it cannot come from a Crypto service.
import { randomUUID } from "node:crypto";

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
