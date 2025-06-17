import { checkoutSessions, db, eq } from "@voidhash/db";
import { Card, Logo } from "@voidhash/ui";
import { CheckoutButtons } from "./checkout-buttons";

export default async function CheckoutPage({
	params,
}: {
	params: Promise<{ checkoutSessionId: string }>;
}) {
	const { checkoutSessionId } = await params;

	const checkoutSession = await db.query.checkoutSessions.findFirst({
		where: eq(checkoutSessions.id, checkoutSessionId),
		with: {
			paymentProviderConfigurationProduct: {
				with: {
					product: true,
				},
			},
		},
	});

	if (!checkoutSession) {
		return <div>Checkout session not found</div>;
	}

	return (
		<div className="h-screen flex bg-background max-w-md mx-auto items-end md:items-center justify-center">
			<Card className="flex flex-col gap-4 p-4 fixed bottom-0 left-0 right-0 md:relative w-full md:left-auto md:right-auto ">
				<Logo className="w-24" />
				<h1 className="text-2xl font-semibold">Purchase (Test)</h1>
				<div className="bg-muted p-4 rounded-md border border-border">
					<p>
						You are about to purchase{" "}
						<span className="font-semibold">
							{checkoutSession.paymentProviderConfigurationProduct.product.name}
						</span>
					</p>
				</div>
				<p className="text-sm text-muted-foreground">
					You won&apos;t be charged for this purchase.
				</p>
				<CheckoutButtons checkoutSessionId={checkoutSessionId} />
			</Card>
		</div>
	);
}
