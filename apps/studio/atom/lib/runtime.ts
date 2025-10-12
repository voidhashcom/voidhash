import { ApiClient } from './api-client';
import { makeAtomRuntime } from './make-api-runtime';

export const runtime = makeAtomRuntime(ApiClient.layer);
