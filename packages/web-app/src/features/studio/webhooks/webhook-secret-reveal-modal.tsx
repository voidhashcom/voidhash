"use client";

import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@voidhash/ui";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

interface WebhookSecretRevealModalProps {
  open: boolean;
  onClose: () => void;
  secret: string | null;
}

export function WebhookSecretRevealModal({ open, onClose, secret }: WebhookSecretRevealModalProps) {
  const copyToClipboard = () => {
    if (secret) {
      void navigator.clipboard.writeText(secret);
      toast.success("Secret copied to clipboard");
    }
  };

  return (
    <Dialog onOpenChange={(isOpen) => !isOpen && onClose()} open={open}>
      <DialogContent className="max-w-md" hideCloseButton>
        <DialogHeader>
          <DialogTitle>Webhook Secret</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-muted-foreground text-sm">
            Copy this secret and store it securely. You will need it to verify webhook signatures.
          </p>
          <div className="flex gap-2">
            <Input className="font-mono text-sm" readOnly value={secret ?? ""} />
            <Button onClick={copyToClipboard} size="icon" variant="outline">
              <CopyIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
