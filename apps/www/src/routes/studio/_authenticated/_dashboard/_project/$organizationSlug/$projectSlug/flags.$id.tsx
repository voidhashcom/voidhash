import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@voidhash/ui";
import { Info } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/features/studio/components/auth-context";

import { EnterpriseAuditLogSlot } from "@/features/studio/enterprise/enterprise-audit-log-slot";
import { FlagGeneralForm } from "@/features/studio/feature-flags/flag-general-form";
import { FlagOverridesPanel } from "@/features/studio/feature-flags/flag-overrides-panel";
import { FlagTargetingPanel } from "@/features/studio/feature-flags/flag-targeting-panel";
import { type FlagType, deriveFlagType } from "@/features/studio/feature-flags/flag-type";
import { FlagTypeBadge } from "@/features/studio/feature-flags/flag-type-badge";
import { FlagVariantsPanel } from "@/features/studio/feature-flags/flag-variants-panel";
import { Page } from "@/features/studio/shell";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";
import {
  archiveFeatureFlagOptions,
  getFeatureFlagOptions,
  queryKeys,
  restoreFeatureFlagOptions,
} from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

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
  const experimentationEnabled = useInternalFeatureFlag(
    INTERNAL_FEATURE_FLAGS.experimentation.key,
  );

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
  const queryClient = useQueryClient();

  if (!project) {
    throw new Error("Project not found");
  }

  const { data: flag } = useSuspenseQuery(getFeatureFlagOptions({ id: id as string }));

  const derivedType = deriveFlagType(flag.variants ?? []);
  const [flagType, setFlagType] = useState<FlagType>(derivedType);

  const hasTargets = (flag.targets ?? []).length > 0;
  const hasOverrides = (flag.overrides ?? []).length > 0;

  const archiveFlag = useMutation({
    ...archiveFeatureFlagOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.featureFlag.getFlag(flag.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.featureFlag.all,
      });
    },
  });

  const restoreFlag = useMutation({
    ...restoreFeatureFlagOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.featureFlag.getFlag(flag.id),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.featureFlag.all,
      });
    },
  });

  const defaultAccordionValues = [
    ...(hasTargets ? ["targeting"] : []),
    ...(hasOverrides ? ["overrides"] : []),
  ];

  return (
    <Page
      breadcrumbs={[
        {
          title: "Feature Flags",
          url: `/${organizationSlug}/${projectSlug}/flags`,
        },
        {
          title: flag.name,
          url: `/${organizationSlug}/${projectSlug}/flags/${id}`,
        },
      ]}
      className="p-0 py-8"
    >
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-normal text-3xl tracking-right">{flag.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-muted-foreground text-sm">{flag.key}</span>
              <FlagTypeBadge flagType={flagType} />
            </div>
          </div>
          {!flag.internal && (
            <div className="flex gap-2">
              {flag.archivedAt ? (
                <Button
                  disabled={restoreFlag.isPending}
                  onClick={() => restoreFlag.mutate({ id: flag.id })}
                  variant="outline"
                >
                  {restoreFlag.isPending ? "Restoring..." : "Restore"}
                </Button>
              ) : (
                <Button
                  disabled={archiveFlag.isPending}
                  onClick={() => archiveFlag.mutate({ id: flag.id })}
                  variant="destructive"
                >
                  {archiveFlag.isPending ? "Archiving..." : "Archive"}
                </Button>
              )}
            </div>
          )}
        </div>

        {flag.internal && (
          <Alert className="mt-4">
            <Info className="h-4 w-4" />
            <AlertDescription>
              This flag is managed internally and cannot be edited directly.
            </AlertDescription>
          </Alert>
        )}

        <div className="mt-8 grid grid-cols-12 gap-6">
          <div className="col-span-9 space-y-6">
            <Tabs onValueChange={(value) => setFlagType(value as FlagType)} value={flagType}>
              <TabsList>
                <TabsTrigger value="boolean">Boolean</TabsTrigger>
                <TabsTrigger value="multivariant">Multi-variant</TabsTrigger>
                <TabsTrigger value="json">JSON</TabsTrigger>
              </TabsList>

              <TabsContent value="boolean">
                <div className="space-y-6">
                  <FlagGeneralForm flag={flag} flagType="boolean" readOnly={flag.internal} />
                </div>
              </TabsContent>

              <TabsContent value="multivariant">
                <div className="space-y-6">
                  <FlagGeneralForm flag={flag} flagType="multivariant" readOnly={flag.internal} />
                  <FlagVariantsPanel
                    featureFlagId={flag.id}
                    flagType="multivariant"
                    readOnly={flag.internal}
                    variants={[...(flag.variants ?? [])]}
                  />
                </div>
              </TabsContent>

              <TabsContent value="json">
                <div className="space-y-6">
                  <FlagGeneralForm flag={flag} flagType="json" readOnly={flag.internal} />
                  <FlagVariantsPanel
                    featureFlagId={flag.id}
                    flagType="json"
                    readOnly={flag.internal}
                    variants={[...(flag.variants ?? [])]}
                  />
                </div>
              </TabsContent>
            </Tabs>

            <Card>
              <Accordion defaultValue={defaultAccordionValues} type="multiple">
                <AccordionItem className="border-b-0" value="targeting">
                  <CardHeader className="py-0">
                    <AccordionTrigger className="py-4">
                      <div className="flex items-center gap-2">
                        Targeting
                        {hasTargets && (
                          <Badge variant="secondary">{(flag.targets ?? []).length}</Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                  </CardHeader>
                  <AccordionContent className="px-0">
                    <CardContent>
                      <FlagTargetingPanel
                        featureFlagId={flag.id}
                        targets={[...(flag.targets ?? [])]}
                      />
                    </CardContent>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem className="border-b-0" value="overrides">
                  <CardHeader className="py-0">
                    <AccordionTrigger className="py-4">
                      <div className="flex items-center gap-2">
                        Overrides
                        {hasOverrides && (
                          <Badge variant="secondary">{(flag.overrides ?? []).length}</Badge>
                        )}
                      </div>
                    </AccordionTrigger>
                  </CardHeader>
                  <AccordionContent className="px-0">
                    <CardContent>
                      <FlagOverridesPanel
                        featureFlagId={flag.id}
                        overrides={[...(flag.overrides ?? [])]}
                      />
                    </CardContent>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </Card>
          </div>
          <div className="col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Version</p>
                  <p>{flag.version}</p>
                </div>
                {flag.createdAt && (
                  <div>
                    <p className="text-muted-foreground">Created</p>
                    <p>{new Date(flag.createdAt).toLocaleDateString()}</p>
                  </div>
                )}
                {flag.updatedAt && (
                  <div>
                    <p className="text-muted-foreground">Updated</p>
                    <p>{new Date(flag.updatedAt).toLocaleDateString()}</p>
                  </div>
                )}
              </CardContent>
            </Card>
            <EnterpriseAuditLogSlot
              entityId={flag.id}
              entityType="feature_flag"
              projectId={project.id}
            />
          </div>
        </div>
      </div>
    </Page>
  );
}
