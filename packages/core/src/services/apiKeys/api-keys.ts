import { constant } from "@voidhash/lib/lang";
import * as Arr from "effect/Array";
import * as Effect from "effect/Effect";
import * as Random from "effect/Random";

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
      promiseOrDie(() => createHash(algorithm).digest(input)),
  });

const keyGenerator = Effect.fn("apiKeys.generate")(function* (options: {
  length: number;
  prefix: string;
}) {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  const body = yield* Effect.forEach(
    Arr.makeBy(options.length, (index) => index),
    () =>
      Random.nextIntBetween(0, characters.length, { halfOpen: true }).pipe(
        Effect.map((index) => characters.charAt(index)),
      ),
    { concurrency: 1 },
  );
  return options.prefix + body.join("");
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
    Effect.map((key) =>
      constant({
        end: key.slice(-KEY_END_LENGTH),
        isPublic: true,
        key,
        prefix: PRODUCTION_PUBLISHABLE_KEY_PREFIX,
        rawKey: key,
      }),
    ),
  );

export const createSecretKey = () =>
  Effect.gen(function* () {
    const key = yield* generateSecretKey();
    const hashed = yield* hashKey(key);
    const end = key.slice(key.length - KEY_END_LENGTH);

    return constant({
      end,
      isPublic: false,
      key: hashed,
      prefix: PRODUCTION_SECRET_KEY_PREFIX,
      rawKey: key,
    });
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
import { promiseOrDie } from "../../effect-boundary.ts";
