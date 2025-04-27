"use client";

import { Button } from "@voidhash/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@voidhash/ui/dialog";
import { CopyText } from "@voidhash/ui/copy-text";
import { ApiKey } from "@/lib/services/api-keys/types";

interface SecretKeyRevealModalProps {
	open: boolean;
	onClose: () => void;
	apiKey: ApiKey | null;
}

export function SecretKeyRevealModal({
	open,
	onClose,

	apiKey,
}: SecretKeyRevealModalProps) {
	const handleOpenChange = (open: boolean) => {
		if (!open) {
			onClose?.();
		}
	};

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Your New Secret Key</DialogTitle>
					<DialogDescription>
						Make sure to copy your new secret key now - you won&apos;t be able
						to see it again!
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-4 pt-4 flex flex-col">
					<div className="space-y-2">
						<label className="text-sm font-medium">Secret Key</label>
						<CopyText
							className="w-full bg-card p-2 border border-border rounded-md text-muted-foreground"
							text={`${apiKey?.rawKey}`}
						/>
					</div>
					<DialogFooter>
						<Button
							type="button"
							onClick={() => handleOpenChange(false)}
							className="w-full mt-4"
						>
							Close
						</Button>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	);
}
