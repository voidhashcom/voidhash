import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { AppleLogo } from "./app-store/apple-logo";
import { StripeLogo } from "./stripe/stripe-logo";

export function PaymentProviderLogo({
	providerId,
	className,
}: {
	providerId: (typeof paymentProviders)[number]["id"];
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
