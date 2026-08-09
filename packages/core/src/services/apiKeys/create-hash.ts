import { subtle } from "uncrypto";

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
  let result = "";
  let buffer = 0;
  let shift = 0;

  for (const byte of data) {
    buffer = (buffer << 8) | byte;
    shift += 8;
    while (shift >= 6) {
      shift -= 6;
      result += alphabet[(buffer >> shift) & 0x3f];
    }
  }

  if (shift > 0) {
    result += alphabet[(buffer << (6 - shift)) & 0x3f];
  }

  if (padding) {
    const padCount = (4 - (result.length % 4)) % 4;
    result += "=".repeat(padCount);
  }

  return result;
};

const base64Decode = (data: string, alphabet: string): Uint8Array => {
  const decodeMap = new Map<string, number>();
  for (let i = 0; i < alphabet.length; i++) {
    decodeMap.set(alphabet[i]!, i);
  }
  const result: number[] = [];
  let buffer = 0;
  let bitsCollected = 0;

  for (const char of data) {
    if (char === "=") {
      break;
    }
    const value = decodeMap.get(char);
    if (value === undefined) {
      // oxlint-disable-next-line effect/noThrowStatement, effect/noNewError -- pure synchronous base64 decoder used from synchronous call sites (including hashing on the Workers request path); throw is the control flow here and the Effect boundary is the caller that wraps this decoder.
      throw new Error(`Invalid Base64 character: ${char}`);
    }
    buffer = (buffer << 6) | value;
    bitsCollected += 6;

    if (bitsCollected >= 8) {
      bitsCollected -= 8;
      result.push((buffer >> bitsCollected) & 0xff);
    }
  }

  return Uint8Array.from(result);
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
  if (typeof data === "string") return new TextEncoder().encode(data);
  return toUint8Array(data);
};

const base64 = {
  decode(data: string | ArrayBuffer | TypedArray) {
    if (typeof data !== "string") {
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
