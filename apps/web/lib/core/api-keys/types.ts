import type { EnvironmentValue } from '@voidhash/lib/index';

export type ApiKey = {
  key: string;
  rawKey?: string;
  environment: EnvironmentValue;
  isPublic: boolean;
  end: string;
  prefix: string;
};
