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
import { CreatePaywallModal } from "./create-paywall-modal";

export function PaywallsPageEmptyState({ projectId }: { projectId: string }) {
	const [open, setOpen] = useState(false);

	return (
		<Card className="max-w-5xl mx-auto w-full text-center">
			<CardHeader>
				<CardTitle>No paywalls yet</CardTitle>
				<CardDescription className="max-w-md text-balance mx-auto">
					Paywalls are screens displayed to your customers. Each paywall can
					have a different set of products, offers, and additional
					configurations that enable you to optimize your checkout experience
					remotely.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<CreatePaywallModal
					open={open}
					onClose={() => setOpen(false)}
					trigger={
						<Button onClick={() => setOpen(true)}>Create paywall</Button>
					}
					projectId={projectId}
					onSuccess={() => setOpen(false)}
				/>
			</CardContent>
		</Card>
	);
}
