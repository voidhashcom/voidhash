import { base64Url, createHash } from '@voidhash/lib';
import type { ApiKey } from '../../types';

const keyGenerator = (options: {
  length: number;
  prefix: string | undefined;
}) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let apiKey = `${options.prefix || ''}`;

  for (const _ of new Array(options.length)) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    apiKey += characters[randomIndex];
  }

  return apiKey;
};

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

async function generateSecretKey() {
  const key = await keyGenerator({
    length: 32,
    prefix: PRODUCTION_SECRET_KEY_PREFIX
  });

  return key;
}

async function generatePublishableKey() {
  const key = await keyGenerator({
    length: 32,
    prefix: PRODUCTION_PUBLISHABLE_KEY_PREFIX
  });

  return key;
}

export const createPublishableKey = async (): Promise<ApiKey> => {
  const key = await generatePublishableKey();
  return {
    key,
    rawKey: key,

    isPublic: true,
    end: key.slice(-KEY_END_LENGTH),
    prefix: PRODUCTION_PUBLISHABLE_KEY_PREFIX
  };
};

export const createSecretKey = async (): Promise<ApiKey> => {
  const key = await generateSecretKey();
  const hashed = await hashKey(key);

  const end = key.slice(key.length - KEY_END_LENGTH);

  return {
    key: hashed,
    rawKey: key,

    isPublic: false,
    end,
    prefix: PRODUCTION_SECRET_KEY_PREFIX
  };
};

export const hashKey = async (key: string) => {
  const hash = await createHash('SHA-256').digest(key);
  const hashed = base64Url.encode(hash, {
    padding: false
  });
  return hashed;
};

export const KEY_END_LENGTH = 4;
