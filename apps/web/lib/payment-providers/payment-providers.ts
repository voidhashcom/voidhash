import { stripe } from "./stripe/stripe";
import { devCheckout } from "./dev-checkout/dev-checkout";
import { appStore } from "./app-store/app-store";

export const paymentProviders = [stripe, devCheckout, appStore] as const;
