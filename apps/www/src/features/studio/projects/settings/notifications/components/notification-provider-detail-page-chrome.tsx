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

/**
 * Page chrome for a notification-provider detail screen: a header with a
 * breadcrumb back to the Notifications list plus the active provider name, and
 * an optional right-aligned action slot (e.g. the Delete menu).
 */
export function NotificationProviderDetailPageChrome({
  actions,
  children,
  organizationSlug,
  projectSlug,
  providerName,
}: {
  actions?: ReactNode;
  children: ReactNode;
  organizationSlug: string;
  projectSlug: string;
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
                  to="/studio/$organizationSlug/$projectSlug/settings/notifications"
                >
                  Notifications
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="gap-1.5">{providerName}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </PageHeader>

      {children}
    </Page>
  );
}
