import { stripeApi } from "./stripe/stripe-api";

export const paymentProviderApis = [stripeApi] as const;
