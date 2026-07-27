"use client";

import { Button, cn } from "@voidhash/ui";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

interface WebhookPayloadViewerProps {
  payload: unknown;
  className?: string;
}

export function WebhookPayloadViewer({ payload, className }: WebhookPayloadViewerProps) {
  const formattedJson = JSON.stringify(payload, null, 2);

  const copyPayload = () => {
    navigator.clipboard.writeText(formattedJson);
    toast.success("Payload copied to clipboard");
  };

  return (
    <div className={cn("relative", className)}>
      <Button className="absolute top-2 right-2" onClick={copyPayload} size="icon" variant="ghost">
        <CopyIcon className="h-4 w-4" />
      </Button>
      <pre className="overflow-auto rounded-md bg-muted p-4 text-sm">
        <code>{formattedJson}</code>
      </pre>
    </div>
  );
}
