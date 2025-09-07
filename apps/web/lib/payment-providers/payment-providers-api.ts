import { appStoreApi } from './app-store/app-store-api';
import { stripeApi } from './stripe/stripe-api';

export const paymentProviderApis = [stripeApi, appStoreApi] as const;
