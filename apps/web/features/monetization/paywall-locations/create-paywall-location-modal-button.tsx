"use client";
import { useState } from "react";
import { Button } from "@voidhash/ui/button";
import { CreatePaywallLocationModal } from "./create-paywall-location-modal";
import { type getPaywalls } from "@/lib/services/paywalls/queries";

export function CreatePaywallLocationModalButton({
	projectId,
	paywalls,
}: { projectId: string; paywalls: Awaited<ReturnType<typeof getPaywalls>> }) {
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
