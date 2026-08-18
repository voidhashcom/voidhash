import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

import { MeasurementInputError } from "./errors";

export interface ProtectedIdentityValue {
  readonly value: string;
  readonly format?: "plaintext" | "sha256";
}

export interface ProtectedIdentityTraits {
  readonly emails?: ReadonlyArray<string | ProtectedIdentityValue>;
  readonly phones?: ReadonlyArray<string | ProtectedIdentityValue>;
  readonly clearEmails?: boolean;
  readonly clearPhones?: boolean;
}

export interface NormalizedProtectedIdentityValue {
  readonly hash: string;
  readonly normalized?: string;
  readonly provenance: "sdk-hashed" | "caller-hashed";
}

export interface ProtectedIdentityUpdateResult {
  readonly status: "stored" | "policyBlocked" | "disabled";
  readonly references: ReadonlyArray<string>;
  readonly cleared: ReadonlyArray<"email" | "phone">;
}

/** Normalizes an email address before protected hashing and storage. */
export const normalizeProtectedEmail = (value: string): string => {
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 320) {
    throw new MeasurementInputError("Email must be a valid address", "email");
  }
  return normalized;
};

/** Normalizes a phone number to the E.164 representation. */
export const normalizeProtectedPhone = (value: string): string => {
  const compact = value.normalize("NFKC").trim().replace(/[\s().-]/g, "");
  const normalized = compact.startsWith("00") ? `+${compact.slice(2)}` : compact;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
    throw new MeasurementInputError("Phone must use E.164 format", "phone");
  }
  return normalized;
};

/** Computes the lowercase SHA-256 value used for protected identity matching. */
export const hashProtectedIdentityValue = (value: string): string =>
  bytesToHex(sha256(new TextEncoder().encode(value)));

const normalizeValue = (
  input: string | ProtectedIdentityValue,
  normalize: (value: string) => string,
): NormalizedProtectedIdentityValue => {
  const descriptor = typeof input === "string" ? { value: input, format: "plaintext" as const } : input;
  if (descriptor.format === "sha256") {
    const hash = descriptor.value.trim().toLowerCase();
    if (!/^[a-f\d]{64}$/.test(hash)) {
      throw new MeasurementInputError("Pre-hashed identity values must be lowercase SHA-256", "hash");
    }
    return { hash, provenance: "caller-hashed" };
  }
  const normalized = normalize(descriptor.value);
  return { hash: hashProtectedIdentityValue(normalized), normalized, provenance: "sdk-hashed" };
};

/** Normalizes and hashes protected email and phone traits deterministically. */
export const normalizeProtectedIdentityTraits = (traits: ProtectedIdentityTraits) => ({
  emails: [...new Map((traits.emails ?? []).map((value) => {
    const normalized = normalizeValue(value, normalizeProtectedEmail);
    return [normalized.hash, normalized] as const;
  })).values()],
  phones: [...new Map((traits.phones ?? []).map((value) => {
    const normalized = normalizeValue(value, normalizeProtectedPhone);
    return [normalized.hash, normalized] as const;
  })).values()],
});
