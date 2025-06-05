import { stripeApi } from "./stripe/stripeApi";

export const paymentProviderApis = [stripeApi] as const;
