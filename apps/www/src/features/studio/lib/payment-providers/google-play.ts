import { GooglePlayLogo } from "@/features/studio/projects/settings/payment-providers/logos/google-play-logo";
import { z } from "zod/v3";

import { createPaymentProvider } from "./core";
import type { PaymentProviderProductEditorSheetSection } from "./types";

const PACKAGE_NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/;
const ENCRYPTED_SECRET_PREFIX = "v1.aesgcm:";
const RTDN_TOPIC_PATTERN = /^projects\/[^/]+\/topics\/[^/]+$/;

const isGoogleServiceAccountKey = (value: string): boolean => {
  if (value.startsWith(ENCRYPTED_SECRET_PREFIX)) {
    return true;
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return (
      parsed.type === "service_account" &&
      typeof parsed.project_id === "string" &&
      parsed.project_id.length > 0 &&
      typeof parsed.private_key_id === "string" &&
      parsed.private_key_id.length > 0 &&
      typeof parsed.private_key === "string" &&
      parsed.private_key.length > 0 &&
      typeof parsed.client_email === "string" &&
      parsed.client_email.length > 0 &&
      typeof parsed.client_id === "string" &&
      parsed.client_id.length > 0
    );
  } catch {
    return false;
  }
};

export const googlePlayGlobalConfigurationSchema = z.object({
  googleRealTimeDeveloperNotificationForwardingUrl: z
    .string()
    .url({ message: "Forwarding URL must be a valid URL" })
    .or(z.literal("")),
  googleRealTimeDeveloperNotificationTopicName: z
    .string()
    .regex(RTDN_TOPIC_PATTERN, {
      message: "Topic name must use projects/{project}/topics/{topic}",
    })
    .or(z.literal("")),
  packageName: z
    .string()
    .min(1, {
      message: "Package name is required",
    })
    .regex(PACKAGE_NAME_PATTERN, {
      message: "Package name must be a valid Android package name",
    }),
  serviceAccountKey: z
    .string()
    .min(1, {
      message: "Service account key file is required",
    })
    .refine(isGoogleServiceAccountKey, {
      message: "Service account key file must be a Google service account JSON",
    }),
});

export type GooglePlayGlobalConfiguration = z.infer<typeof googlePlayGlobalConfigurationSchema>;

const googlePlayProductConfigurationSchema = z.object({
  basePlanId: z.string().optional(),
  productId: z.string().min(1, {
    message: "Product ID is required",
  }),
});

export const googlePlay = createPaymentProvider({
  defaultGlobalConfiguration: {
    googleRealTimeDeveloperNotificationForwardingUrl: "",
    googleRealTimeDeveloperNotificationTopicName: "",
    packageName: "",
    serviceAccountKey: "",
  },
  defaultProductConfiguration: {
    basePlanId: "",
    productId: "",
  },
  getProductConfigurationSheet(): {
    sections: PaymentProviderProductEditorSheetSection[];
  } {
    return {
      sections: [
        {
          input: {
            placeholder: "monthly_subscription",
            type: "text",
          },
          key: "productId",
          label: "Product ID",
          name: "productId",
          type: "text-input",
        },
        {
          input: {
            placeholder: "monthly-base-plan",
            type: "text",
          },
          key: "basePlanId",
          label: "Base Plan ID",
          name: "basePlanId",
          type: "text-input",
        },
      ],
    };
  },
  globalConfigurationSchema: googlePlayGlobalConfigurationSchema,
  id: "google-play",
  logo: GooglePlayLogo,
  productConfigurationKeyProperties: ["productId", "basePlanId"],
  productConfigurationSchema: googlePlayProductConfigurationSchema,
  title: "Google Play",
  type: "native",
});
