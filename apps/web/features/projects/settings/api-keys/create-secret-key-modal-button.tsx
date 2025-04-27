"use client";

import { Button } from "@voidhash/ui/button";
import { CreateSecretKeyModal } from "./create-secret-key-modal";
import { useState } from "react";
import { SecretKeyRevealModal } from "./secret-key-reveal-modal";
import { ApiKey } from "@/lib/services/api-keys/types";

export function CreateSecretKeyModalButton({
	projectId,
}: {
	projectId: string;
}) {
	const [open, setOpen] = useState(false);
	const [secretKey, setSecretKey] = useState<ApiKey | null>(null);
	return (
		<>
			<CreateSecretKeyModal
				open={open}
				onClose={() => setOpen(false)}
				onSuccess={(apiKey) => {
					setOpen(false);
					setSecretKey(apiKey);
				}}
				trigger={
					<Button variant={"outline"} onClick={() => setOpen(true)}>
						Create secret key
					</Button>
				}
				projectId={projectId}
			/>
			<SecretKeyRevealModal
				open={!!secretKey}
				onClose={() => setSecretKey(null)}
				apiKey={secretKey}
			/>
		</>
	);
}
