import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { AppleLogo } from "./logos/apple-logo";
import { StripeLogo } from "./logos/stripe-logo";

export function PaymentProviderLogo({
	providerId,
	className,
}: {
	providerId: ReturnType<(typeof paymentProviders)[number]["getId"]>;
	className?: string;
}) {
	if (providerId === "app-store") {
		return <AppleLogo className={className} />;
	}

	if (providerId === "stripe") {
		return <StripeLogo className={className} />;
	}

	return null;
}
