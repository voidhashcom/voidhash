import type { paymentProviders } from "@/features/studio/lib/payment-providers/payment-providers";

import { AppleLogo } from "./logos/apple-logo";
import { GooglePlayLogo } from "./logos/google-play-logo";
import { StripeLogo } from "./logos/stripe-logo";

export function PaymentProviderLogo({
  providerId,
  className,
}: {
  providerId: (typeof paymentProviders)[number]["id"];
  className?: string;
}) {
  if (providerId === "apple-app-store") {
    return <AppleLogo className={className} />;
  }

  if (providerId === "stripe") {
    return <StripeLogo className={className} />;
  }

  if (providerId === "google-play") {
    return <GooglePlayLogo className={className} />;
  }

  return null;
}
