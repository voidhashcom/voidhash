import { Effect } from "effect";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import {
  Alert,
  AlertDescription,
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Page,
  PageHeader,
} from "@voidhash/ui";
import { FlaskConicalIcon, InfoIcon } from "lucide-react";
import { useAuth } from "@/features/studio/components/auth-context";

import { EnterpriseAuditLogSlot } from "@/features/studio/enterprise/enterprise-audit-log-slot";
import { FlagDetailActionBar } from "@/features/studio/feature-flags/components/flag-detail-page/flag-detail-action-bar";
import { FlagDetailActionsMenu } from "@/features/studio/feature-flags/components/flag-detail-page/flag-detail-actions-menu";
import { FlagDetailHeader } from "@/features/studio/feature-flags/components/flag-detail-page/flag-detail-header";
import { FlagDetailProperties } from "@/features/studio/feature-flags/components/flag-detail-page/flag-detail-properties";
import { FlagDraftProvider } from "@/features/studio/feature-flags/components/flag-detail-page/flag-draft-context";
import { FlagOverridesPanel } from "@/features/studio/feature-flags/components/flag-detail-page/flag-overrides-panel";
import { FlagTargetingPanel } from "@/features/studio/feature-flags/components/flag-detail-page/flag-targeting-panel";
import { FlagVariantsPanel } from "@/features/studio/feature-flags/components/flag-detail-page/flag-variants-panel";
import { getFeatureFlagOptions } from "@/features/studio/lib/tanstack-query";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/flags/$id",
)({
  component: FlagDetailRoute,
  errorComponent: FlagDetailPageError,
});

/**
 * Gate the feature-flag detail page behind the `experimentation` internal
 * feature flag, matching the flags list route.
 */
function FlagDetailRoute() {
  const experimentationEnabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.experimentation.key);

  if (!experimentationEnabled) {
    return (
      <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "This page is not available." }} />
    );
  }

  return <FlagDetailPage />;
}

function FlagDetailPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the feature flag",
      }}
    />
  );
}

function FlagDetailPage() {
  const { id, organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    return Effect.runSync(Effect.die(new Error("Project not found")));
  }

  const { data: flag } = useSuspenseQuery(getFeatureFlagOptions({ id: id as string }));

  const isArchived = flag.archivedAt != null;
  const isReadOnly = flag.internal || isArchived;

  return (
    <FlagDraftProvider flag={flag} readOnly={isReadOnly}>
      <Page className="flex min-h-[calc(100svh-var(--header-height))] flex-col">
        <PageHeader
          className="px-2"
          rightActions={
            flag.internal ? undefined : (
              <FlagDetailActionsMenu flagId={flag.id} isArchived={isArchived} />
            )
          }
        >
          <div className="flex items-center gap-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      params={{ organizationSlug, projectSlug }}
                      to="/studio/$organizationSlug/$projectSlug/flags"
                    >
                      Feature Flags
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{flag.slug}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            {isArchived && <Badge variant="secondary">Archived</Badge>}
            {flag.internal && (
              <Badge variant="outline">
                <FlaskConicalIcon className="mr-1 size-3" />
                Internal
              </Badge>
            )}
          </div>
        </PageHeader>

        <div className="mx-auto w-full max-w-6xl flex-1 px-8 py-12">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="space-y-10 lg:col-span-8">
              <FlagDetailHeader flagType={flag.type} slug={flag.slug} />

              {flag.internal && (
                <Alert>
                  <InfoIcon className="size-4" />
                  <AlertDescription>
                    This flag is managed internally and cannot be edited directly.
                  </AlertDescription>
                </Alert>
              )}

              {flag.type !== "boolean" && <FlagVariantsPanel flagType={flag.type} />}

              <FlagTargetingPanel />

              <FlagOverridesPanel />

              <EnterpriseAuditLogSlot
                entityId={flag.id}
                entityType="feature_flag"
                projectId={project.id}
              />
            </div>

            <div className="lg:col-span-4">
              <div className="lg:sticky lg:top-24">
                <FlagDetailProperties
                  archivedAt={flag.archivedAt}
                  createdAt={flag.createdAt}
                  flagType={flag.type}
                  updatedAt={flag.updatedAt}
                  version={flag.version}
                />
              </div>
            </div>
          </div>
        </div>

        <FlagDetailActionBar />
      </Page>
    </FlagDraftProvider>
  );
}
