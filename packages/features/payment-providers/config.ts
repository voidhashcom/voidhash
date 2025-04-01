import { stripe } from "./providers/stripe/stripe";
import { PaymentProvider } from "./lib/types";

export const paymentProviders = [stripe] satisfies PaymentProvider[];
