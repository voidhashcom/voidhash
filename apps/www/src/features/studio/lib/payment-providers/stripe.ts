import { StripeLogo } from "@/features/studio/projects/settings/payment-providers/logos/stripe-logo";
import { z } from "zod/v3";

import { createPaymentProvider } from "./core";
import type { PaymentProviderProductEditorSheetSection } from "./types";

const ENCRYPTED_SECRET_PREFIX = "v1.aesgcm:";
const STRIPE_ACCOUNT_ID_PATTERN = /^acct_[A-Za-z0-9]+$/;
const STRIPE_WEBHOOK_SECRET_PATTERN = /^whsec_[A-Za-z0-9]+$/;
const STRIPE_PRODUCT_ID_PATTERN = /^prod_[A-Za-z0-9]+$/;
const STRIPE_PRICE_ID_PATTERN = /^price_[A-Za-z0-9]+$/;

const isEncryptedSecret = (value: string): boolean =>
  value.startsWith(ENCRYPTED_SECRET_PREFIX);

const stripeCredentialsSchema = (mode: "live" | "test") =>
  z.object({
    secretKey: z
      .string()
      .min(1, {
        message:
          mode === "live"
            ? "Live API key is required"
            : "Test API key is required",
      })
      .refine(
        (value) =>
          isEncryptedSecret(value) ||
          value.startsWith(`sk_${mode}_`) ||
          value.startsWith(`rk_${mode}_`),
        {
          message:
            mode === "live"
              ? "Live API key must start with sk_live_ or rk_live_"
              : "Test API key must start with sk_test_ or rk_test_",
        },
      ),
    webhookSecret: z
      .string()
      .min(1, {
        message:
          mode === "live"
            ? "Live webhook signing secret is required"
            : "Test webhook signing secret is required",
      })
      .refine(
        (value) =>
          isEncryptedSecret(value) || STRIPE_WEBHOOK_SECRET_PATTERN.test(value),
        {
          message: "Webhook signing secret must start with whsec_",
        },
      ),
  });

export const stripeGlobalConfigurationSchema = z.object({
  accountId: z
    .string()
    .min(1, {
      message: "Stripe account ID is required",
    })
    .regex(STRIPE_ACCOUNT_ID_PATTERN, {
      message: "Stripe account ID must start with acct_",
    }),
  live: stripeCredentialsSchema("live"),
  test: stripeCredentialsSchema("test"),
});

export type StripeGlobalConfiguration = z.infer<
  typeof stripeGlobalConfigurationSchema
>;

const stripeProductConfigurationSchema = z.object({
  priceId: z
    .string()
    .min(1, {
      message: "Price ID is required",
    })
    .regex(STRIPE_PRICE_ID_PATTERN, {
      message: "Price ID must start with price_",
    }),
  productId: z
    .string()
    .min(1, {
      message: "Product ID is required",
    })
    .regex(STRIPE_PRODUCT_ID_PATTERN, {
      message: "Product ID must start with prod_",
    }),
});

export const stripe = createPaymentProvider({
  defaultGlobalConfiguration: {
    accountId: "",
    live: {
      secretKey: "",
      webhookSecret: "",
    },
    test: {
      secretKey: "",
      webhookSecret: "",
    },
  },
  defaultProductConfiguration: {
    priceId: "",
    productId: "",
  },
  getProductConfigurationSheet(): {
    sections: PaymentProviderProductEditorSheetSection[];
  } {
    return {
      sections: [
        {
          input: {
            placeholder: "prod_123456789",
            type: "text",
          },
          key: "productId",
          label: "Product ID",
          name: "productId",
          type: "text-input",
        },
        {
          input: {
            placeholder: "price_123456789",
            type: "text",
          },
          key: "priceId",
          label: "Price ID",
          name: "priceId",
          type: "text-input",
        },
      ],
    };
  },
  globalConfigurationSchema: stripeGlobalConfigurationSchema,
  id: "stripe",
  logo: StripeLogo,
  productConfigurationKeyProperties: ["productId", "priceId"],
  productConfigurationSchema: stripeProductConfigurationSchema,
  title: "Stripe",
  type: "web-checkout",
});
