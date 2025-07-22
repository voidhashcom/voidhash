import type { App } from '@/lib/api/hono/app';

export const createPaymentProviderApi = (api: {
  registerEndpoints: (app: App) => void;
}) => {
  return api;
};
