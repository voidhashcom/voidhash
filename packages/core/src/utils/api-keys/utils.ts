import {
  base64Url,
  createHash,
  Environment as EnvironmentEnum,
  type EnvironmentValue
} from '@voidhash/lib';
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
  environment: EnvironmentValue;
};

export type PublishableKey = {
  id: string;
  key: string;
  isPublic: true;
  end: string;
  prefix: string;
  environment: EnvironmentValue;
};

export const PRODUCTION_SECRET_KEY_PREFIX = 'vh_sk_';
export const TESTING_SECRET_KEY_PREFIX = 'vh_sk_test_';
export const PRODUCTION_PUBLISHABLE_KEY_PREFIX = 'vh_pk_';
export const TESTING_PUBLISHABLE_KEY_PREFIX = 'vh_pk_test_';

async function generateSecretKey(environment: EnvironmentValue) {
  const key = await keyGenerator({
    length: 32,
    prefix:
      environment === EnvironmentEnum.Production
        ? PRODUCTION_SECRET_KEY_PREFIX
        : TESTING_SECRET_KEY_PREFIX
  });

  return key;
}

async function generatePublishableKey(environment: EnvironmentValue) {
  const key = await keyGenerator({
    length: 32,
    prefix:
      environment === EnvironmentEnum.Production
        ? PRODUCTION_PUBLISHABLE_KEY_PREFIX
        : TESTING_PUBLISHABLE_KEY_PREFIX
  });

  return key;
}

export const createPublishableKey = async (
  environment: EnvironmentValue
): Promise<ApiKey> => {
  const key = await generatePublishableKey(environment);
  return {
    key,
    rawKey: key,
    environment,
    isPublic: true,
    end: key.slice(-KEY_END_LENGTH),
    prefix:
      environment === EnvironmentEnum.Production
        ? PRODUCTION_PUBLISHABLE_KEY_PREFIX
        : TESTING_PUBLISHABLE_KEY_PREFIX
  };
};

export const createSecretKey = async (
  environment: EnvironmentValue
): Promise<ApiKey> => {
  const key = await generateSecretKey(environment);
  const hashed = await hashKey(key);

  const end = key.slice(key.length - KEY_END_LENGTH);

  return {
    key: hashed,
    rawKey: key,
    environment,
    isPublic: false,
    end,
    prefix:
      environment === EnvironmentEnum.Production
        ? PRODUCTION_SECRET_KEY_PREFIX
        : TESTING_SECRET_KEY_PREFIX
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
