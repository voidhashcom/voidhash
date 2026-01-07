"use client";

import type { ApiKeyWithRawKey } from "@voidhash/rpc";
import { Button } from "@voidhash/ui/button";
import { CopyText } from "@voidhash/ui/copy-text";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@voidhash/ui/dialog";

interface SecretKeyRevealModalProps {
  open: boolean;
  onClose: () => void;
  apiKey: typeof ApiKeyWithRawKey.Type | null;
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
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Your New Secret Key</DialogTitle>
          <DialogDescription>
            Make sure to copy your new secret key now - you won&apos;t be able
            to see it again!
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col space-y-4 pt-4">
          <div className="space-y-2">
            <label className="font-medium text-sm" htmlFor="secret-key">
              Secret Key
            </label>
            <CopyText
              className="w-full rounded-md border border-border bg-card p-2 text-muted-foreground"
              text={`${apiKey?.rawKey}`}
            />
          </div>
          <DialogFooter>
            <Button
              className="mt-4 w-full"
              onClick={() => handleOpenChange(false)}
              type="button"
            >
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
