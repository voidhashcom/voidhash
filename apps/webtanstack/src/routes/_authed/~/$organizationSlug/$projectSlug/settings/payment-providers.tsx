import { createFileRoute } from "@tanstack/react-router";
import { PaymentProvidersList } from "@voidhash/features/payment-providers/client/components/payment-providers-list";
import { Page } from "@voidhash/ui";

export const Route = createFileRoute(
	"/_authed/~/$organizationSlug/$projectSlug/settings/payment-providers"
)({
	component: RouteComponent,
});

function RouteComponent() {
	return (
		<Page>
			{/* Key is used to reload the default form data when the organization slug changes */}
			<div className="max-w-4xl mx-auto">
				<h1 className="text-3xl font-normal tracking-right">
					Payment Providers
				</h1>
				<p className="text-muted-foreground mt-3">
					Configure your payment providers
				</p>
				<div className="mt-8">
					<PaymentProvidersList />
				</div>
			</div>
		</Page>
	);
}
