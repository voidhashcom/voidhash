import {
  stripe,
  type StripeGlobalConfiguration,
} from "@/features/studio/lib/payment-providers/stripe";
import type { FieldPath } from "react-hook-form";

export type StripeTabId = "account" | "live-credentials" | "test-credentials";

export interface StripePaymentProviderDetailTab {
  fields: FieldPath<StripeGlobalConfiguration>[];
  id: StripeTabId;
  label: string;
}

type StripeStoredConfiguration = Partial<StripeGlobalConfiguration>;

export const STRIPE_TABS: StripePaymentProviderDetailTab[] = [
  {
    fields: ["accountId"],
    id: "account",
    label: "Account",
  },
  {
    fields: ["live.secretKey", "live.webhookSecret"],
    id: "live-credentials",
    label: "Live credentials",
  },
  {
    fields: ["test.secretKey", "test.webhookSecret"],
    id: "test-credentials",
    label: "Test credentials",
  },
];

export const STRIPE_FIELD_LABELS: Partial<
  Record<FieldPath<StripeGlobalConfiguration>, string>
> = {
  accountId: "Stripe account ID",
  "live.secretKey": "Live API key",
  "live.webhookSecret": "Live webhook signing secret",
  "test.secretKey": "Test API key",
  "test.webhookSecret": "Test webhook signing secret",
};

/**
 * Builds the Stripe webhook endpoint URL from an API origin or `/api` base.
 * Stripe configures one webhook endpoint per mode (live/test), both pointing at this URL.
 */
export function getStripeWebhookEndpointUrl({
  apiUrl,
  paymentProviderConfigurationId,
}: {
  apiUrl: string;
  paymentProviderConfigurationId: string;
}): string {
  const normalizedApiUrl = apiUrl.replace(/\/+$/, "");
  const normalizedApiBaseUrl = normalizedApiUrl.endsWith("/api")
    ? normalizedApiUrl
    : `${normalizedApiUrl}/api`;
  return `${normalizedApiBaseUrl}/v1/inbound-webhooks/stripe/${paymentProviderConfigurationId}`;
}

const OPTIONAL_FIELDS = new Set<FieldPath<StripeGlobalConfiguration>>();

export function isStripeOptionalField(
  field: FieldPath<StripeGlobalConfiguration>,
  _values?: StripeGlobalConfiguration,
): boolean {
  return OPTIONAL_FIELDS.has(field);
}

export function getStripeInitialConfiguration(
  configuration: StripeStoredConfiguration | null | undefined,
): StripeGlobalConfiguration {
  const defaults = stripe.defaultGlobalConfiguration;

  return {
    ...defaults,
    ...configuration,
    live: {
      ...defaults.live,
      ...configuration?.live,
    },
    test: {
      ...defaults.test,
      ...configuration?.test,
    },
  };
}
