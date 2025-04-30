"use client";
import { useState } from "react";
import { Button } from "@voidhash/ui/button";
import { CreatePaywallModal } from "./create-paywall-modal";

export function CreatePaywallModalButton({ projectId }: { projectId: string }) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<CreatePaywallModal
				open={open}
				onClose={() => setOpen(false)}
				trigger={<Button onClick={() => setOpen(true)}>Add Paywall</Button>}
				projectId={projectId}
				onSuccess={() => setOpen(false)}
			/>
		</>
	);
}
