"use client";

import { Link } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Page,
  PageHeader,
} from "@voidhash/ui";
import type { ReactNode } from "react";

export function PaymentProviderDetailPageChrome({
  actions,
  children,
  organizationSlug,
  projectSlug,
  providerIcon,
  providerName,
}: {
  actions?: ReactNode;
  children: ReactNode;
  organizationSlug: string;
  projectSlug: string;
  providerIcon: ReactNode;
  providerName: string;
}) {
  return (
    <Page className="flex min-h-[calc(100svh-var(--header-height))] flex-col">
      <PageHeader className="px-2" rightActions={actions}>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  params={{ organizationSlug, projectSlug }}
                  to="/studio/$organizationSlug/$projectSlug/settings/payment-providers"
                >
                  Payment Providers
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="gap-1.5">
                {providerIcon}
                {providerName}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      {children}
    </Page>
  );
}
