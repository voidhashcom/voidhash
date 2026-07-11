import { Effect } from "effect";

import { base64Url, createHash, type SHAFamily, type TypedArray } from "./create-hash.ts";

export interface SecretKey {
  id: string;
  key: string;
  isPublic: false;
  end: string;
  prefix: string;
}

export interface PublishableKey {
  id: string;
  key: string;
  isPublic: true;
  end: string;
  prefix: string;
}

export const PRODUCTION_SECRET_KEY_PREFIX = "vh_sk_";
export const PRODUCTION_PUBLISHABLE_KEY_PREFIX = "vh_pk_";
export const KEY_END_LENGTH = 4;

const createHashEf = (algorithm: SHAFamily) =>
  Effect.succeed({
    digest: (input: string | ArrayBuffer | TypedArray) =>
      Effect.promise(() => createHash(algorithm).digest(input)),
  });

const keyGenerator = (options: { length: number; prefix: string | undefined }) =>
  Effect.sync(() => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let apiKey = `${options.prefix || ""}`;
    for (const _ of Array.from({ length: options.length })) {
      apiKey += characters[Math.floor(Math.random() * characters.length)];
    }
    return apiKey;
  });

export const hashKey = (key: string) =>
  createHashEf("SHA-256").pipe(
    Effect.flatMap((hashingFn) => hashingFn.digest(key)),
    Effect.map((hash) => base64Url.encode(hash, { padding: false })),
  );

export const generateSecretKey = () =>
  keyGenerator({
    length: 32,
    prefix: PRODUCTION_SECRET_KEY_PREFIX,
  });

export const generatePublishableKey = () =>
  keyGenerator({
    length: 32,
    prefix: PRODUCTION_PUBLISHABLE_KEY_PREFIX,
  });

export const createPublishableKey = () =>
  generatePublishableKey().pipe(
    Effect.map((key) => ({
      end: key.slice(-KEY_END_LENGTH),
      isPublic: true as const,
      key,
      prefix: PRODUCTION_PUBLISHABLE_KEY_PREFIX,
      rawKey: key,
    })),
  );

export const createSecretKey = () =>
  Effect.gen(function* () {
    const key = yield* generateSecretKey();
    const hashed = yield* hashKey(key);
    const end = key.slice(key.length - KEY_END_LENGTH);

    return {
      end,
      isPublic: false as const,
      key: hashed,
      prefix: PRODUCTION_SECRET_KEY_PREFIX,
      rawKey: key,
    };
  });

export const generateUserApiKey = (prefix: string) =>
  keyGenerator({
    length: 32,
    prefix,
  });

export const createUserApiKey = (prefix: string) =>
  Effect.gen(function* () {
    const key = yield* generateUserApiKey(prefix);
    const hashed = yield* hashKey(key);
    const end = key.slice(key.length - KEY_END_LENGTH);

    return {
      end,
      key: hashed,
      prefix,
      rawKey: key,
    };
  });
