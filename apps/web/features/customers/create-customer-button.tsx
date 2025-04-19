"use client";

import { Button } from "@voidhash/ui";
import { CreateCustomerModal } from "./create-customer-modal";
import { useState } from "react";

export function CreateCustomerButton({ projectId }: { projectId: string }) {
	const [open, setOpen] = useState(false);
	return (
		<CreateCustomerModal
			open={open}
			onClose={() => setOpen(false)}
			trigger={<Button onClick={() => setOpen(true)}>Create Customer</Button>}
			projectId={projectId}
		/>
	);
}
