"use client";
import { useState } from "react";
import { Button } from "@voidhash/ui/button";
import { CreatePaywallLocationModal } from "./create-paywall-location-modal";
import type { Paywall } from "@voidhash/db";

export function CreatePaywallLocationModalButton({
	projectId,
	paywalls,
}: { projectId: string; paywalls: Paywall[] }) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<CreatePaywallLocationModal
				open={open}
				onClose={() => setOpen(false)}
				paywalls={paywalls}
				trigger={
					<Button onClick={() => setOpen(true)}>Add Paywall Location</Button>
				}
				projectId={projectId}
				onSuccess={() => setOpen(false)}
			/>
		</>
	);
}
