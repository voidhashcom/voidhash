"use client";

import { useLocation } from "@tanstack/react-router";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import { Sidebar } from "@voidhash/ui";
import {
  ChartNoAxesColumnIncreasing,
  FlaskConical,
  GaugeIcon,
  Gift,
  Logs,
  MapPin,
  Package2,
  Settings,
  Smartphone,
  ToggleLeft,
  Users,
} from "lucide-react";
import * as React from "react";

import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";

import { SidebarShell } from "./sidebar-shell";

export function ProjectSidebar({
  collapsible = "icon",
  organizationSlug,
  projectSlug,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  organizationSlug: string;
  projectSlug: string;
}) {
  const pathname = useLocation({
    select: (location) => location.pathname,
  });
  // The VoidQL Query page is gated behind an internal feature flag (unreleased).
  const queryEnabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.voidqlQuery.key);
  const customAnalyticsEnabled = useInternalFeatureFlag(
    INTERNAL_FEATURE_FLAGS.customAnalytics.key,
  );
  const notificationsEnabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.notifications.key);

  const experimentationEnabled = useInternalFeatureFlag(
    INTERNAL_FEATURE_FLAGS.experimentation.key,
  );

  const data = {
    navMain: [
      {
        items: [
          {
            icon: GaugeIcon,
            isActive: () =>
              pathname ===
              `/studio/${organizationSlug}/${projectSlug}/overview`,
            title: "Overview",
            url: `/studio/${organizationSlug}/${projectSlug}/overview`,
          },
          {
            icon: ChartNoAxesColumnIncreasing,
            isActive: () =>
              pathname.startsWith(
                `/studio/${organizationSlug}/${projectSlug}/analytics`,
              ),
            title: "Analytics",
            url: customAnalyticsEnabled
              ? `/studio/${organizationSlug}/${projectSlug}/analytics/insights`
              : `/studio/${organizationSlug}/${projectSlug}/analytics/revenue`,
            items: [
              ...(customAnalyticsEnabled
                ? [
                    {
                      isActive: () =>
                        pathname.startsWith(
                          `/studio/${organizationSlug}/${projectSlug}/analytics/insights`,
                        ),
                      title: "Insights",
                      url: `/studio/${organizationSlug}/${projectSlug}/analytics/insights`,
                    },
                    {
                      isActive: () =>
                        pathname.startsWith(
                          `/studio/${organizationSlug}/${projectSlug}/analytics/dashboards`,
                        ),
                      title: "Dashboards",
                      url: `/studio/${organizationSlug}/${projectSlug}/analytics/dashboards`,
                    },
                  ]
                : []),
              {
                isActive: () =>
                  `/studio/${organizationSlug}/${projectSlug}/analytics/revenue` ===
                  pathname,
                title: "Revenue",
                url: `/studio/${organizationSlug}/${projectSlug}/analytics/revenue`,
              },
              {
                isActive: () =>
                  pathname.startsWith(
                    `/studio/${organizationSlug}/${projectSlug}/analytics/subscribers`,
                  ),
                title: "Subscribers",
                url: `/studio/${organizationSlug}/${projectSlug}/analytics/subscribers`,
              },

              {
                isActive: () =>
                  pathname.startsWith(
                    `/studio/${organizationSlug}/${projectSlug}/analytics/trials`,
                  ),
                title: "Trials",
                url: `/studio/${organizationSlug}/${projectSlug}/analytics/trials`,
              },
              {
                isActive: () =>
                  pathname.startsWith(
                    `/studio/${organizationSlug}/${projectSlug}/analytics/churn`,
                  ),
                title: "Churn",
                url: `/studio/${organizationSlug}/${projectSlug}/analytics/churn`,
              },
              ...(queryEnabled
                ? [
                    {
                      isActive: () =>
                        pathname.startsWith(
                          `/studio/${organizationSlug}/${projectSlug}/analytics/query`,
                        ),
                      title: "Query",
                      url: `/studio/${organizationSlug}/${projectSlug}/analytics/query`,
                    },
                  ]
                : []),
            ],
          },
          {
            title: "People",
            url: `/studio/${organizationSlug}/${projectSlug}/persons`,
            icon: Users,
            isActive: () =>
              pathname.startsWith(
                `/studio/${organizationSlug}/${projectSlug}/persons`,
              ),
          },
          {
            title: "Products",
            url: `/studio/${organizationSlug}/${projectSlug}/products`,
            icon: Package2,
            isActive: () =>
              pathname.startsWith(
                `/studio/${organizationSlug}/${projectSlug}/products`,
              ) ||
              pathname.startsWith(
                `/studio/${organizationSlug}/${projectSlug}/settings/perks`,
              ),
            items: [
              {
                icon: Package2,
                isActive: () =>
                  pathname.startsWith(
                    `/studio/${organizationSlug}/${projectSlug}/products`,
                  ),
                title: "Products",
                url: `/studio/${organizationSlug}/${projectSlug}/products`,
              },
              {
                icon: Gift,
                isActive: () =>
                  pathname.startsWith(
                    `/studio/${organizationSlug}/${projectSlug}/settings/perks`,
                  ),
                title: "Perks",
                url: `/studio/${organizationSlug}/${projectSlug}/settings/perks`,
              },
            ],
          },
          {
            icon: Smartphone,
            isActive: () =>
              pathname.startsWith(
                `/studio/${organizationSlug}/${projectSlug}/paywalls`,
              ) ||
              pathname.startsWith(
                `/studio/${organizationSlug}/${projectSlug}/settings/paywall-locations`,
              ),
            title: "Paywalls",
            url: `/studio/${organizationSlug}/${projectSlug}/paywalls`,
            items: [
              {
                icon: Smartphone,
                isActive: () =>
                  pathname.startsWith(
                    `/studio/${organizationSlug}/${projectSlug}/paywalls`,
                  ),
                title: "Paywalls",
                url: `/studio/${organizationSlug}/${projectSlug}/paywalls`,
              },
              {
                icon: MapPin,
                isActive: () =>
                  pathname.startsWith(
                    `/studio/${organizationSlug}/${projectSlug}/settings/paywall-locations`,
                  ),
                title: "Paywall Locations",
                url: `/studio/${organizationSlug}/${projectSlug}/settings/paywall-locations`,
              },
            ],
          },
          // The Experimentation suite (Feature Flags + A/B Tests) is gated behind
          // the `experimentation` internal feature flag so it can be rolled out
          // to a subset of testers from overwatch before a public launch.
          ...(experimentationEnabled
            ? [
                {
                  icon: FlaskConical,
                  isActive: () =>
                    pathname.startsWith(
                      `/studio/${organizationSlug}/${projectSlug}/flags`,
                    ) ||
                    pathname.startsWith(
                      `/studio/${organizationSlug}/${projectSlug}/experiments`,
                    ),
                  title: "Experimentation",
                  url: `/studio/${organizationSlug}/${projectSlug}/flags`,
                  items: [
                    {
                      icon: ToggleLeft,
                      isActive: () =>
                        pathname.startsWith(
                          `/studio/${organizationSlug}/${projectSlug}/flags`,
                        ),
                      title: "Feature Flags",
                      url: `/studio/${organizationSlug}/${projectSlug}/flags`,
                    },
                    {
                      icon: FlaskConical,
                      isActive: () =>
                        pathname.startsWith(
                          `/studio/${organizationSlug}/${projectSlug}/experiments`,
                        ),
                      title: "A/B Tests",
                      url: `/studio/${organizationSlug}/${projectSlug}/experiments`,
                    },
                  ],
                },
              ]
            : []),
          {
            icon: Logs,
            isActive: () =>
              pathname.startsWith(
                `/studio/${organizationSlug}/${projectSlug}/activity`,
              ),
            title: "Activity",
            url: `/studio/${organizationSlug}/${projectSlug}/activity/events`,
            items: [
              {
                isActive: () =>
                  pathname.startsWith(
                    `/studio/${organizationSlug}/${projectSlug}/activity/events`,
                  ),
                title: "Analytics events",
                url: `/studio/${organizationSlug}/${projectSlug}/activity/events`,
              },
              ...(notificationsEnabled
                ? [
                    {
                      isActive: () =>
                        pathname.startsWith(
                          `/studio/${organizationSlug}/${projectSlug}/activity/sent-notifications`,
                        ),
                      title: "Sent notifications",
                      url: `/studio/${organizationSlug}/${projectSlug}/activity/sent-notifications`,
                    },
                  ]
                : []),
            ],
          },
          {
            icon: Settings,
            isActive: () =>
              pathname.startsWith(
                `/studio/${organizationSlug}/${projectSlug}/settings`,
              ),
            title: "Settings",
            url: `/studio/${organizationSlug}/${projectSlug}/settings`,
            items: [
              {
                isActive: () =>
                  pathname ===
                  `/studio/${organizationSlug}/${projectSlug}/settings`,
                title: "General",
                url: `/studio/${organizationSlug}/${projectSlug}/settings`,
              },
              {
                isActive: () =>
                  pathname.startsWith(
                    `/studio/${organizationSlug}/${projectSlug}/settings/api-keys`,
                  ),
                title: "API Keys",
                url: `/studio/${organizationSlug}/${projectSlug}/settings/api-keys`,
              },
              {
                isActive: () =>
                  pathname.startsWith(
                    `/studio/${organizationSlug}/${projectSlug}/settings/webhooks`,
                  ),
                title: "Webhooks",
                url: `/studio/${organizationSlug}/${projectSlug}/settings/webhooks`,
              },
              {
                isActive: () =>
                  pathname.startsWith(
                    `/studio/${organizationSlug}/${projectSlug}/settings/payment-providers`,
                  ),
                title: "Payment Providers",
                url: `/studio/${organizationSlug}/${projectSlug}/settings/payment-providers`,
              },
              ...(notificationsEnabled
                ? [
                    {
                      isActive: () =>
                        pathname.startsWith(
                          `/studio/${organizationSlug}/${projectSlug}/settings/notifications`,
                        ),
                      title: "Notifications",
                      url: `/studio/${organizationSlug}/${projectSlug}/settings/notifications`,
                    },
                  ]
                : []),
            ],
          },
        ],
      },
    ],
  };

  return (
    <SidebarShell
      className="transition-all duration-75"
      collapsible={collapsible}
      organizationSlug={organizationSlug}
      groups={data.navMain}
      {...props}
    />
    // <Sidebar
    //   className="h-full border-r transition-all duration-75"
    //   collapsible={collapsible}
    //   variant="inset"
    //   {...props}
    // >
    //   <SidebarContent>
    //     <div className="h-[var(--header-height)]">
    //       <OrganizationSwitcher organizationSlug={organizationSlug} />
    //     </div>
    //     <NavMain defaultOpenNested={true} groups={data.navMain} link={Link} />
    //   </SidebarContent>
    // </Sidebar>
  );
}
