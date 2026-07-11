"use client";

import { Button, Input } from "@voidhash/ui";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

export function PaymentProviderCopyableValue({
  copyLabel = "Copy value",
  copySuccessMessage,
  value,
}: {
  copyLabel?: string;
  copySuccessMessage: string;
  value: string;
}) {
  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(value);
    toast.success(copySuccessMessage);
  };

  return (
    <div className="flex w-full min-w-0 items-center gap-2 sm:w-96">
      <Input readOnly value={value} />
      <Button
        aria-label={copyLabel}
        onClick={copyToClipboard}
        size="icon"
        type="button"
        variant="outline"
      >
        <CopyIcon className="h-4 w-4" />
      </Button>
    </div>
  );
}
