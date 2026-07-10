import { randomUUID } from "node:crypto";
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
