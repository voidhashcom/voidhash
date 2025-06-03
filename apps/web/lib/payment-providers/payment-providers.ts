import { appStore } from "./app-store/app-store";
import { devCheckout } from "./dev-checkout/dev-checkout";
import { stripe } from "./stripe/stripe";

export const paymentProviders = [devCheckout, stripe, appStore] as const;
