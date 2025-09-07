import { appStore } from './app-store/app-store';
import { stripe } from './stripe/stripe';

export const paymentProviders = [stripe, appStore] as const;
