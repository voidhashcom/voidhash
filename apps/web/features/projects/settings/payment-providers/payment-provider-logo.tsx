import { paymentProviders } from "@/lib/payment-providers/payment-providers";
import { AppleLogo } from "./logos/apple-logo";
import { StripeLogo } from "./logos/stripe-logo";
import { cn, Logo } from "@voidhash/ui";

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

	if (providerId === "dev-checkout") {
		return (
			<div
				className={cn(
					"bg-primary p-1 rounded-md w-full h-full flex items-center justify-center",
					className
				)}
			>
				<Logo
					variant="symbol"
					color="mono"
					className="w-full h-full text-white"
				/>
			</div>
		);
	}

	return null;
}
