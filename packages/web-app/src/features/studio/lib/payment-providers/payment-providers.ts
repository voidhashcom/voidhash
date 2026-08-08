import { appleAppStore } from "./app-store";
import { googlePlay } from "./google-play";
import { stripe } from "./stripe";

export const paymentProviders = [appleAppStore, googlePlay, stripe];
