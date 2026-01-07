"use client";
import { Link } from "@tanstack/react-router";
import type { Paywall } from "@voidhash/rpc";

export function PaywallRecord({
  paywall,
  organizationSlug,
  projectSlug,
}: {
  paywall: typeof Paywall.Type;
  organizationSlug: string;
  projectSlug: string;
}) {
  return (
    <div className="group relative isolate px-6 py-4 hover:bg-accent/30">
      <Link
        className="absolute inset-0 h-full w-full"
        params={{ id: paywall.id, organizationSlug, projectSlug }}
        to="/$organizationSlug/$projectSlug/design/$id"
      />
      <div className="flex flex-row items-center justify-between">
        <div className="flex flex-1 items-center gap-4">
          <div className="flex items-baseline gap-4">
            <div>{paywall.name}</div>
            <code className="text-muted-foreground text-sm">
              {paywall.slug}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
