import type { Command, Path, Value } from "../core/types.ts";
import type { Schema } from "../schema/types.ts";

export class PrimitiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrimitiveError";
  }
}

export interface CommandSession {
  readonly current: () => Value;
  readonly emit: (commands: readonly Command[]) => void;
  readonly generator: {
    nextArrayItemId(path: Path): string;
    nextTreeNodeId(path: Path): string;
    between(lower?: string, upper?: string): string;
  };
}

export interface Primitive<TInput, TSnapshot, TProxy> {
  readonly _tag: string;
  readonly _Input: TInput;
  readonly _Snapshot: TSnapshot;
  readonly _Proxy: TProxy;

  readonly schema: Schema;

  encode(input: TInput): Value;
  decode(value: Value | undefined): TSnapshot | undefined;
  createProxy(session: CommandSession, path: Path): TProxy;
}

export interface PrimitiveWithOptionalEncoding<TInput, TSnapshot, TProxy> extends Primitive<
  TInput,
  TSnapshot,
  TProxy
> {
  encodeOptional(input: unknown): Value | undefined;
}

export type AnyPrimitive = PrimitiveWithOptionalEncoding<any, any, any>;

export type InferInput<T extends AnyPrimitive> = T["_Input"];
export type InferSnapshot<T extends AnyPrimitive> = T["_Snapshot"];
export type InferProxy<T extends AnyPrimitive> = T["_Proxy"];

export type Optional<T> = T | undefined;

export type MaybeUndefined<
  T,
  TRequired extends boolean,
  THasDefault extends boolean,
> = TRequired extends false ? (THasDefault extends false ? Optional<T> : T) : T;

export type NeedsValue<
  T,
  TRequired extends boolean,
  THasDefault extends boolean,
> = TRequired extends true ? (THasDefault extends false ? T : Optional<T>) : Optional<T>;

export interface BasePrimitiveState<TInput> {
  readonly required: boolean;
  readonly defaultValue: TInput | undefined;
}

export const expectDefined = <T>(value: T | undefined, message: string): T => {
  if (value === undefined) {
    throw new PrimitiveError(message);
  }
  return value;
};

export const hasOwn = <T extends object>(value: T, key: PropertyKey): key is keyof T =>
  Object.prototype.hasOwnProperty.call(value, key);

export const randomUuid = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.();
  if (typeof uuid === "string") {
    return uuid;
  }
  throw new PrimitiveError("crypto.randomUUID is not available in this runtime");
};

/**
 * Alphabet for {@link shortId} — URL-safe, unambiguous alphanumerics. Length 62
 * (10 digits + 26 lower + 26 upper); a random draw over it carries ~5.95 bits of
 * entropy per character.
 */
const SHORT_ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Default {@link shortId} length: 10 chars ≈ 59 bits of entropy. */
const SHORT_ID_LENGTH = 10;

/**
 * Mint a short (default 10-char) alphanumeric opaque id from
 * `crypto.getRandomValues`. Node ids appear in printed paywall composition
 * source, so they use this instead of {@link randomUuid} to cut token noise —
 * ids are opaque strings everywhere in the CRDT engine, so short and UUID ids
 * coexist. Array-item ids (never surfaced in source) keep using `randomUuid`.
 *
 * Uses rejection sampling so the alphabet maps uniformly onto the byte range (no
 * modulo bias), matching nanoid's algorithm without the dependency.
 */
export const shortId = (length: number = SHORT_ID_LENGTH): string => {
  const getRandomValues = globalThis.crypto?.getRandomValues?.bind(globalThis.crypto);
  if (!getRandomValues) {
    throw new PrimitiveError("crypto.getRandomValues is not available in this runtime");
  }
  const alphabetSize = SHORT_ID_ALPHABET.length;
  // Largest multiple of alphabetSize ≤ 256; bytes at or above it are rejected so
  // the surviving range divides evenly and every character is equiprobable.
  const acceptLimit = Math.floor(256 / alphabetSize) * alphabetSize;
  let id = "";
  const buffer = new Uint8Array(length);
  while (id.length < length) {
    getRandomValues(buffer);
    for (let i = 0; i < buffer.length && id.length < length; i += 1) {
      const byte = buffer[i]!;
      if (byte < acceptLimit) {
        id += SHORT_ID_ALPHABET[byte % alphabetSize];
      }
    }
  }
  return id;
};
