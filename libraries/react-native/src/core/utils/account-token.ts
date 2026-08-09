import { sha1 } from "@noble/hashes/legacy.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { Effect } from "effect";

/** Shared UUIDv5 namespace for StoreKit and Google Play account identifiers. */
export const VOIDHASH_ACCOUNT_TOKEN_NAMESPACE = "3919eb4e-3466-593c-8c1e-84554e13a0a6";

const uuidToBytes = (uuid: string): Uint8Array => {
  const hex = uuid.replaceAll("-", "");
  if (!/^[0-9a-fA-F]{32}$/.test(hex)) {
    return Effect.runSync(Effect.die(new TypeError(`Invalid UUID namespace: ${uuid}`)));
  }

  const bytes = new Uint8Array(16);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
};

const bytesToUuid = (bytes: Uint8Array): string => {
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Derives an RFC 4122 UUIDv5 from a namespace UUID and UTF-8 name. */
export const uuidV5 = (namespaceUuid: string, name: string): string => {
  const namespaceBytes = uuidToBytes(namespaceUuid);
  const nameBytes = utf8ToBytes(name);
  const input = new Uint8Array(namespaceBytes.length + nameBytes.length);
  input.set(namespaceBytes);
  input.set(nameBytes, namespaceBytes.length);

  const bytes = sha1(input).slice(0, 16);
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
  return bytesToUuid(bytes);
};

/** Derives the deterministic account token supplied to StoreKit and Google Play. */
export const deriveAccountToken = (distinctId: string): string =>
  uuidV5(VOIDHASH_ACCOUNT_TOKEN_NAMESPACE, distinctId);
