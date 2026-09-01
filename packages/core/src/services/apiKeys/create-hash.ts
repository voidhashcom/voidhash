import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import { subtle } from "uncrypto";

import { runSync, unexpectedError } from "../../effect-boundary.ts";

export type TypedArray =
  | Uint8Array
  | Int8Array
  | Uint16Array
  | Int16Array
  | Uint32Array
  | Int32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

export type SHAFamily = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";
export type EncodingFormat = "hex" | "base64" | "base64url" | "base64urlnopad" | "none";

const getAlphabet = (urlSafe: boolean): string => {
  if (urlSafe) return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  return "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
};

const base64Encode = (data: Uint8Array, alphabet: string, padding: boolean): string => {
  const encoded = Arr.reduce(
    Arr.fromIterable(data),
    { buffer: 0, result: "", shift: 0 },
    (state, byte) => {
      const buffer = (state.buffer << 8) | byte;
      const availableBits = state.shift + 8;
      const emissionCount = Math.floor(availableBits / 6);
      const emitted = Arr.reduce(
        Arr.range(1, emissionCount),
        { result: state.result, shift: availableBits },
        (current) => {
          const shift = current.shift - 6;
          return {
            result: current.result + alphabet.charAt((buffer >> shift) & 0x3f),
            shift,
          };
        },
      );
      return { buffer, result: emitted.result, shift: emitted.shift };
    },
  );

  const result =
    encoded.shift > 0
      ? encoded.result + alphabet.charAt((encoded.buffer << (6 - encoded.shift)) & 0x3f)
      : encoded.result;
  if (!padding) return result;
  const padCount = (4 - (result.length % 4)) % 4;
  return result + "=".repeat(padCount);
};

const invalidBase64Character = (char: string): never =>
  runSync(Effect.die(unexpectedError(`Invalid Base64 character: ${char}`)));

const base64Decode = (data: string, alphabet: string): Uint8Array => {
  const decodeMap = Arr.reduce(
    Arr.fromIterable(alphabet),
    HashMap.empty<string, number>(),
    (map, char, index) => HashMap.set(map, char, index),
  );
  const decoded = Arr.reduce(
    Arr.takeWhile(Arr.fromIterable(data), (char) => char !== "="),
    { bitsCollected: 0, buffer: 0, result: Arr.empty<number>() },
    (state, char) => {
      const value = HashMap.get(decodeMap, char);
      if (Option.isNone(value)) return invalidBase64Character(char);
      const buffer = (state.buffer << 6) | value.value;
      const bitsCollected = state.bitsCollected + 6;
      if (bitsCollected < 8) return { bitsCollected, buffer, result: state.result };
      const remainingBits = bitsCollected - 8;
      return {
        bitsCollected: remainingBits,
        buffer,
        result: Arr.append(state.result, (buffer >> remainingBits) & 0xff),
      };
    },
  );

  return Uint8Array.from(decoded.result);
};

const toUint8Array = (data: ArrayBuffer | TypedArray): Uint8Array => {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (data instanceof BigInt64Array || data instanceof BigUint64Array) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
};

const toBytes = (data: ArrayBuffer | TypedArray | string): Uint8Array => {
  if (P.isString(data)) return new TextEncoder().encode(data);
  return toUint8Array(data);
};

const base64 = {
  decode(data: string | ArrayBuffer | TypedArray) {
    if (!P.isString(data)) {
      data = new TextDecoder().decode(toUint8Array(data));
    }
    const urlSafe = data.includes("-") || data.includes("_");
    const alphabet = getAlphabet(urlSafe);
    return base64Decode(data, alphabet);
  },
  encode(data: ArrayBuffer | TypedArray | string, options: { padding?: boolean } = {}) {
    const alphabet = getAlphabet(false);
    return base64Encode(toBytes(data), alphabet, options.padding ?? true);
  },
};

export const base64Url = {
  decode(data: string) {
    const urlSafe = data.includes("-") || data.includes("_");
    const alphabet = getAlphabet(urlSafe);
    return base64Decode(data, alphabet);
  },
  encode(data: ArrayBuffer | TypedArray | string, options: { padding?: boolean } = {}) {
    const alphabet = getAlphabet(true);
    return base64Encode(toBytes(data), alphabet, options.padding ?? true);
  },
};

export type HashInput = string | ArrayBuffer | TypedArray;

export interface Hasher<Output> {
  readonly digest: (input: HashInput) => Promise<Output>;
}

const encodeDigest = (hashBuffer: ArrayBuffer, encoding?: EncodingFormat): ArrayBuffer | string => {
  if (encoding === "hex") {
    const hashArray = [...new Uint8Array(hashBuffer)];
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  if (encoding === "base64url" || encoding === "base64urlnopad") {
    return base64Url.encode(hashBuffer, { padding: encoding !== "base64urlnopad" });
  }
  if (encoding === "base64") {
    return base64.encode(hashBuffer);
  }
  return hashBuffer;
};

/**
 * Builds a digest helper for `algorithm`, optionally encoding the digest bytes.
 *
 * The overloads carry what a conditional return type used to: omitting the
 * encoding (or passing `"none"`) yields the raw `ArrayBuffer`, any other
 * encoding yields an encoded string.
 */
export function createHash(algorithm: SHAFamily, encoding?: "none"): Hasher<ArrayBuffer>;
export function createHash(
  algorithm: SHAFamily,
  encoding: Exclude<EncodingFormat, "none">,
): Hasher<string>;
export function createHash(
  algorithm: SHAFamily,
  encoding?: EncodingFormat,
): Hasher<ArrayBuffer | string> {
  return {
    digest: (input) =>
      subtle
        .digest(algorithm, new Uint8Array(toBytes(input)))
        .then((hashBuffer) => encodeDigest(hashBuffer, encoding)),
  };
}
