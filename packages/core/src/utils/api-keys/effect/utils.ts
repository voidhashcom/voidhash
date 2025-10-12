import { base64Url, createHashEf } from '@voidhash/lib';
import { Effect } from 'effect';

export type SecretKey = {
  id: string;
  key: string;
  isPublic: false;
  end: string;
  prefix: string;
};

export type PublishableKey = {
  id: string;
  key: string;
  isPublic: true;
  end: string;
  prefix: string;
};

export const PRODUCTION_SECRET_KEY_PREFIX = 'vh_sk_';
export const PRODUCTION_PUBLISHABLE_KEY_PREFIX = 'vh_pk_';
export const KEY_END_LENGTH = 4;

const keyGenerator = (options: {
  length: number;
  prefix: string | undefined;
}) =>
  Effect.sync(() => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let apiKey = `${options.prefix || ''}`;
    for (const _ of Array.from({ length: options.length })) {
      apiKey += characters[Math.floor(Math.random() * characters.length)];
    }
    return apiKey;
  });

export const hashKey = (key: string) =>
  createHashEf('SHA-256').pipe(
    Effect.flatMap((hashingFn) => hashingFn.digest(key)),
    Effect.map((hash) => base64Url.encode(hash, { padding: false }))
  );

export const generateSecretKey = () =>
  keyGenerator({
    length: 32,
    prefix: PRODUCTION_SECRET_KEY_PREFIX
  });

export const generatePublishableKey = () =>
  keyGenerator({
    length: 32,
    prefix: PRODUCTION_PUBLISHABLE_KEY_PREFIX
  });

export const createPublishableKey = () =>
  generatePublishableKey().pipe(
    Effect.map((key) => ({
      key,
      rawKey: key,
      isPublic: true,
      end: key.slice(-KEY_END_LENGTH),
      prefix: PRODUCTION_PUBLISHABLE_KEY_PREFIX
    }))
  );

export const createSecretKey = () =>
  Effect.gen(function* () {
    const key = yield* generateSecretKey();
    const hashed = yield* hashKey(key);
    const end = key.slice(key.length - KEY_END_LENGTH);

    return {
      key: hashed,
      rawKey: key,
      isPublic: false,
      end,
      prefix: PRODUCTION_SECRET_KEY_PREFIX
    };
  });
