import { Badge } from "@voidhash/ui";
import type { ReactNode } from "react";

import { PaymentProviderLogo } from "../payment-provider-logo";

export function PaymentProviderDetailHeader({
  providerId,
  title,
  enabled,
  actions,
}: {
  providerId: string;
  title: string;
  enabled: boolean;
  actions?: ReactNode;
}) {
  return (
    <span className="flex min-w-0 flex-1 items-center justify-between gap-4">
      <span className="flex min-w-0 items-center gap-3">
        <PaymentProviderLogo className="h-7 w-7 shrink-0" providerId={providerId} />
        <span className="truncate">{title}</span>
        {enabled ? (
          <Badge className="shrink-0 text-[11px]">Enabled</Badge>
        ) : (
          <Badge className="shrink-0 text-[11px]" variant="outline">
            Disabled
          </Badge>
        )}
      </span>
      {actions ? <span className="flex shrink-0 items-center gap-2">{actions}</span> : null}
    </span>
  );
}
