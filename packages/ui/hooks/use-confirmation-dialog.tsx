import React, { useState, useCallback } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export type ConfirmDialogConfig = {
	title: string;
	description: string;
	confirmInput?: string;
	confirmText?: string;
	cancelText?: string;
	variant?: "default" | "destructive";
};
// Custom hook to manage the confirmation dialog
export function useConfirmDialog() {
	const [isOpen, setIsOpen] = useState(false);
	const [resolveCallback, setResolveCallback] = useState<
		((resolve: boolean) => void) | null
	>(null);
	const [dialogConfig, setDialogConfig] = useState<ConfirmDialogConfig>({
		title: "",
		description: "",
		confirmInput: undefined,
		confirmText: "Confirm",
		cancelText: "Cancel",
	});

	const openDialog = useCallback((config: ConfirmDialogConfig) => {
		setIsOpen(true);
		setDialogConfig(config);
		return new Promise((resolve) => {
			setResolveCallback(() => resolve);
		});
	}, []);

	const handleConfirm = useCallback(() => {
		resolveCallback?.(true);
		setIsOpen(false);
	}, [resolveCallback]);

	const handleCancel = useCallback(() => {
		setIsOpen(false);
		resolveCallback?.(false);
	}, [resolveCallback]);

	const ConfirmationDialog = useCallback(() => {
		// eslint-disable-next-line react-hooks/rules-of-hooks
		const [confirmInput, setConfirmInput] = useState<string | undefined>(
			undefined
		);
		return (
			<AlertDialog open={isOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{dialogConfig.title}</AlertDialogTitle>
						<AlertDialogDescription>
							{dialogConfig.description}
						</AlertDialogDescription>
					</AlertDialogHeader>
					{dialogConfig.confirmInput && (
						<div>
							<p className="mb-4">
								Please type{" "}
								<code className="mx-2 bg-slate-200">
									{dialogConfig.confirmInput}
								</code>{" "}
								to confirm.
							</p>
							<Label htmlFor="confirm-input" className="sr-only">
								Confirm input
							</Label>
							<Input
								id="confirm-input"
								type="text"
								placeholder={dialogConfig.confirmInput}
								value={confirmInput}
								onChange={(e) => setConfirmInput(e.currentTarget.value)}
							/>
						</div>
					)}
					<AlertDialogFooter>
						<AlertDialogCancel onClick={handleCancel}>
							{dialogConfig.cancelText ?? "Cancel"}
						</AlertDialogCancel>
						<AlertDialogAction
							onClick={handleConfirm}
							variant={dialogConfig.variant}
							disabled={
								(!!dialogConfig.confirmInput &&
									confirmInput !== dialogConfig.confirmInput) ??
								false
							}
						>
							{dialogConfig.confirmText ?? "Confirm"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		);
	}, [isOpen, dialogConfig, handleConfirm, handleCancel]);

	return { openDialog, ConfirmationDialog };
}
