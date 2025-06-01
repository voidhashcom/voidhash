"use client";

import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
	Button,
} from "@voidhash/ui";
import { useState } from "react";
import { CreatePaywallLocationModal } from "./create-paywall-location-modal";
import type { Paywall } from "@voidhash/db";

export function PaywallLocationsPageEmptyState({
	projectId,
	paywalls,
}: { projectId: string; paywalls: Paywall[] }) {
	const [open, setOpen] = useState(false);

	return (
		<Card className="max-w-5xl mx-auto w-full text-center">
			<CardHeader>
				<CardTitle>No paywall locations yet</CardTitle>
				<CardDescription className="max-w-md text-balance mx-auto">
					Paywall locations are places across your app where you show a paywall
					to the customer. This allows you to switch between paywalls without
					having to change the code.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<CreatePaywallLocationModal
					open={open}
					paywalls={paywalls}
					onClose={() => setOpen(false)}
					trigger={
						<Button onClick={() => setOpen(true)}>
							Create paywall location
						</Button>
					}
					projectId={projectId}
					onSuccess={() => setOpen(false)}
				/>
			</CardContent>
		</Card>
	);
}
