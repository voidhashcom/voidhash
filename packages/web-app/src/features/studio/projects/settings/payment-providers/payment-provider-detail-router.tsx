import type { PaymentProviderConfiguration } from "@voidhash/rpc";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

import { AppleAppStorePaymentProviderDetailPage } from "./providers/apple-app-store-payment-provider-detail-page";
import { GooglePlayPaymentProviderDetailPage } from "./providers/google-play-payment-provider-detail-page";
import { StripePaymentProviderDetailPage } from "./providers/stripe-payment-provider-detail-page";

export function PaymentProviderDetailRouter({
  organizationSlug,
  projectSlug,
  project,
  paymentProviderConfiguration,
}: {
  organizationSlug: string;
  projectSlug: string;
  project: { id: string };
  paymentProviderConfiguration: typeof PaymentProviderConfiguration.Type;
}) {
  switch (paymentProviderConfiguration.providerId) {
    case "apple-app-store":
      return (
        <AppleAppStorePaymentProviderDetailPage
          organizationSlug={organizationSlug}
          paymentProviderConfiguration={paymentProviderConfiguration}
          project={project}
          projectSlug={projectSlug}
        />
      );
    case "google-play":
      return (
        <GooglePlayPaymentProviderDetailPage
          organizationSlug={organizationSlug}
          paymentProviderConfiguration={paymentProviderConfiguration}
          project={project}
          projectSlug={projectSlug}
        />
      );
    case "stripe":
      return (
        <StripePaymentProviderDetailPage
          organizationSlug={organizationSlug}
          paymentProviderConfiguration={paymentProviderConfiguration}
          project={project}
          projectSlug={projectSlug}
        />
      );
    default:
      return (
        <VoidhashErrorCard
          error={{
            code: "UNSUPPORTED_PAYMENT_PROVIDER",
            message: "Unsupported payment provider",
          }}
        />
      );
  }
}
