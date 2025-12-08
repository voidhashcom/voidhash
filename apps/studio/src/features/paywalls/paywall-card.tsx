'use client';

import { Link } from '@tanstack/react-router';
import type { Paywall } from '@voidhash/rpc';
import { Smartphone } from 'lucide-react';

interface PaywallCardProps {
  paywall: typeof Paywall.Type;
  organizationSlug: string;
  projectSlug: string;
}

export function PaywallCard({
  paywall,
  organizationSlug,
  projectSlug
}: PaywallCardProps) {
  return (
    <Link
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:border-foreground/20 hover:shadow-lg"
      params={{ organizationSlug, projectSlug, id: paywall.id }}
      to="/$organizationSlug/$projectSlug/design/$id"
    >
      {/* Preview Area */}
      <div className="flex aspect-3/4 items-center justify-center bg-muted/50">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Smartphone className="h-12 w-12 opacity-30" />
        </div>
      </div>

      {/* Info Area */}
      <div className="border-t p-4">
        <h3 className="truncate font-medium">{paywall.name}</h3>
        <p className="mt-0.5 truncate text-muted-foreground text-sm">
          {paywall.slug}
        </p>
      </div>
    </Link>
  );
}
