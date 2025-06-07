import {
	cancelDevCheckoutPurchaseAction,
	confirmDevCheckoutPurchaseAction,
} from "@/lib/nextjs/server-actions";
import { checkoutSessions, db, eq } from "@voidhash/db";
import { Button, Card, Logo } from "@voidhash/ui";

import { redirect } from "next/navigation";

export default async function CheckoutPage({
	params,
}: {
	params: Promise<{ checkoutSessionId: string }>;
}) {
	const { checkoutSessionId } = await params;

	const checkoutSession = await db.query.checkoutSessions.findFirst({
		where: eq(checkoutSessions.id, checkoutSessionId),
		with: {
			product: true,
		},
	});

	if (!checkoutSession) {
		return <div>Checkout session not found</div>;
	}

	const handleConfirm = async () => {
		"use server";

		console.log(checkoutSessionId);

		try {
			const res = await confirmDevCheckoutPurchaseAction({
				checkoutSessionId,
			});
			redirect(
				`${res?.data ?? ""}?checkoutSessionId=${checkoutSessionId}&success=true`
			);
		} catch (e) {
			console.log(e);
		}
	};

	const handleCancel = async () => {
		"use server";

		console.log(checkoutSessionId);

		try {
			const res = await cancelDevCheckoutPurchaseAction({
				checkoutSessionId,
			});

			redirect(
				`${res?.data ?? ""}?checkoutSessionId=${checkoutSessionId}&error=cancelled`
			);
		} catch (e) {
			console.log(e);
		}
	};

	return (
		<div className="h-screen flex bg-background max-w-md mx-auto items-end md:items-center justify-center">
			<Card className="flex flex-col gap-4 p-4 fixed bottom-0 left-0 right-0 md:relative w-full md:left-auto md:right-auto ">
				<Logo className="w-24" />
				<h1 className="text-2xl font-semibold">Purchase (Test)</h1>
				<div className="bg-muted p-4 rounded-md border border-border">
					<p>
						You are about to purchase{" "}
						<span className="font-semibold">
							{checkoutSession.product.name}
						</span>
					</p>
				</div>
				<p className="text-sm text-muted-foreground">
					You won&apos;t be charged for this purchase.
				</p>
				<form action={handleConfirm}>
					<Button className="w-full">Confirm Purchase</Button>
				</form>
				<form action={handleCancel}>
					<Button variant="outline" className="w-full">
						Cancel
					</Button>
				</form>
			</Card>
		</div>
	);
}
