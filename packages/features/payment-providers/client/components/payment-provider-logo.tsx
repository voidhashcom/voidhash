import { paymentProviders } from "@voidhash/lib";
import { AppleLogo } from "../../providers/app-store/components/apple-logo";

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

	return null;
}
