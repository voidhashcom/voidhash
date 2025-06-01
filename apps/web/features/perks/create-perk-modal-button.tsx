"use client";
import { useState } from "react";
import { Button } from "@voidhash/ui/button";
import { CreatePerkModal } from "./create-perk-modal";

export function CreatePerkModalButton({ projectId }: { projectId: string }) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<CreatePerkModal
				open={open}
				onClose={() => setOpen(false)}
				trigger={<Button onClick={() => setOpen(true)}>Add Perk</Button>}
				projectId={projectId}
				onSuccess={() => setOpen(false)}
			/>
		</>
	);
}
