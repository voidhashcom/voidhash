"use client";

import { Link } from "@tanstack/react-router";
import type { Paywall } from "@voidhash/rpc";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@voidhash/ui";
import { Smartphone } from "lucide-react";

import { PaywallActionsMenu } from "./paywall-actions-menu";

interface PaywallTableProps {
  paywalls: readonly (typeof Paywall.Type)[];
  organizationSlug: string;
  projectSlug: string;
}

/**
 * Compact table view of the paywall dashboard — an alternative to the card
 * grid, selectable from the view-settings dropdown. Each row links to the
 * paywall detail page and carries the same kebab actions as the grid card.
 */
export function PaywallTable({ paywalls, organizationSlug, projectSlug }: PaywallTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-0" />
          <TableHead>Name</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-0" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {paywalls.map((paywall) => (
          <PaywallTableRow
            key={paywall.id}
            organizationSlug={organizationSlug}
            paywall={paywall}
            projectSlug={projectSlug}
          />
        ))}
      </TableBody>
    </Table>
  );
}

interface PaywallTableRowProps {
  paywall: typeof Paywall.Type;
  organizationSlug: string;
  projectSlug: string;
}

function PaywallTableRow({ paywall, organizationSlug, projectSlug }: PaywallTableRowProps) {
  const isArchived = paywall.archivedAt != null;
  const detailLink = {
    params: { id: paywall.id, organizationSlug, projectSlug },
    to: "/studio/$organizationSlug/$projectSlug/paywalls/$id",
  } as const;

  return (
    <TableRow className={isArchived ? "opacity-60" : undefined}>
      <TableCell className="py-2">
        <Link
          className="block h-11 w-8 overflow-hidden rounded-md bg-linear-150 from-blue-ribbon-950 to-electric-violet-950 ring-1 ring-border ring-inset"
          {...detailLink}
        >
          {paywall.thumbnailUrl ? (
            <img
              alt=""
              className="size-full object-cover object-top"
              loading="lazy"
              src={paywall.thumbnailUrl}
            />
          ) : (
            <span className="flex size-full items-center justify-center">
              <Smartphone className="size-4 text-zinc-400 opacity-40" />
            </span>
          )}
        </Link>
      </TableCell>
      <TableCell>
        <Link className="font-medium hover:underline" {...detailLink}>
          {paywall.name}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">{paywall.slug}</TableCell>
      <TableCell>
        <Badge variant={isArchived ? "secondary" : "outline"}>
          {isArchived ? "Archived" : "Active"}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <PaywallActionsMenu
          organizationSlug={organizationSlug}
          paywall={paywall}
          projectSlug={projectSlug}
        />
      </TableCell>
    </TableRow>
  );
}
