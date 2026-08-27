import { createHash } from "node:crypto";

/** Generate a random document/database/collection/user identifier. */
export const randomId = (): string => globalThis.crypto.randomUUID();

/**
 * Deterministic SHA-256 hex digest used for password and token storage.
 *
 * The synchronous implementation works in the supported Node and workerd
 * adapter runtimes without async WebCrypto plumbing.
 */
export const hashHex = (value: string): string => createHash("sha256").update(value).digest("hex");
