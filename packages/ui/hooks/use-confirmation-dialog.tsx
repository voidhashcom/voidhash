"use client";
import * as Effect from "effect/Effect";
import * as EffectRuntime from "effect/Effect";
import * as React from "react";

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

export interface ConfirmDialogConfig {
  title: string;
  description: string;
  confirmInput?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
}
// Custom hook to manage the confirmation dialog
export function useConfirmDialog() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [resolveCallback, setResolveCallback] = React.useState<(resolve: boolean) => void>();
  const [dialogConfig, setDialogConfig] = React.useState<ConfirmDialogConfig>({
    cancelText: "Cancel",
    confirmInput: undefined,
    confirmText: "Confirm",
    description: "",
    title: "",
  });

  const openDialog = React.useCallback((config: ConfirmDialogConfig) => {
    setIsOpen(true);
    setDialogConfig(config);
    return EffectRuntime.runPromise(
      Effect.callback<boolean>((resume) => {
        setResolveCallback(() => (value: boolean) => {
          resume(Effect.succeed(value));
        });
      }),
    );
  }, []);

  const handleConfirm = React.useCallback(() => {
    resolveCallback?.(true);
    setIsOpen(false);
  }, [resolveCallback]);

  const handleCancel = React.useCallback(() => {
    setIsOpen(false);
    resolveCallback?.(false);
  }, [resolveCallback]);

  const ConfirmationDialog = React.useCallback(() => {
    const [confirmInput, setConfirmInput] = React.useState<string>();
    return (
      <AlertDialog open={isOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogConfig.title}</AlertDialogTitle>
            <AlertDialogDescription>{dialogConfig.description}</AlertDialogDescription>
          </AlertDialogHeader>
          {dialogConfig.confirmInput && (
            <div>
              <p className="mb-4">
                Please type <code className="mx-2 bg-slate-200">{dialogConfig.confirmInput}</code>{" "}
                to confirm.
              </p>
              <Label className="sr-only" htmlFor="confirm-input">
                Confirm input
              </Label>
              <Input
                id="confirm-input"
                onChange={(e) => setConfirmInput(e.currentTarget.value)}
                placeholder={dialogConfig.confirmInput}
                type="text"
                value={confirmInput}
              />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>
              {dialogConfig.cancelText ?? "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                (!!dialogConfig.confirmInput && confirmInput !== dialogConfig.confirmInput) ?? false
              }
              onClick={handleConfirm}
              variant={dialogConfig.variant}
            >
              {dialogConfig.confirmText ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }, [isOpen, dialogConfig, handleConfirm, handleCancel]);

  return { ConfirmationDialog, openDialog };
}
