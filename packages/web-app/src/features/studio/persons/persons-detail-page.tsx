"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Switch } from "@voidhash/ui";
import { format } from "date-fns";
import { Clock4Icon } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/features/studio/components/auth-context";
import { getPersonByDistinctIdOptions } from "@/features/studio/lib/tanstack-query/persons";
import {
  applyDevelopmentLifecycleActionOptions,
  getDevelopmentModeStateOptions,
} from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

import { Page } from "../shell";
import { VoidhashErrorCard } from "../shell/components/voidhash-error-card";

export const PersonDetailPage = () => {
  const [showDevelopmentData, setShowDevelopmentData] = useState(false);
  const { id: distinctId, organizationSlug, projectSlug } = useParams({ strict: false });
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    // oxlint-disable-next-line effect/noThrowStatement -- React render-path guard: throwing is how a component hands control to the route error boundary, and a render function is not an Effect.
    throw new Error("Project not found");
  }

  const {
    data: person,
    status,
    // error
  } = useQuery(
    getPersonByDistinctIdOptions({
      distinctId: distinctId as string,
      projectId: project.id,
    }),
  );
  const developmentState = useQuery({
    ...getDevelopmentModeStateOptions({
      personId: person?.personId ?? "",
      projectId: project.id,
    }),
    enabled: showDevelopmentData && Boolean(person?.personId),
  });
  const queryClient = useQueryClient();
  const lifecycleMutation = useMutation({
    ...applyDevelopmentLifecycleActionOptions(),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ["development-mode", "person", project.id, person?.personId],
      }),
  });

  const applyAction = (
    action: "expire" | "revoke" | "renew" | "refund" | "grace_period",
    targetType: "subscription" | "purchase",
    targetId: string,
  ) => {
    lifecycleMutation.mutate({
      action,
      actionId: crypto.randomUUID(),
      projectId: project.id,
      targetId,
      targetType,
    });
  };

  if (status === "pending") {
    return <Page className="p-0 py-8 pt-3">Loading person...</Page>;
  }

  if (status === "error") {
    return (
      <VoidhashErrorCard
        error={{
          code: "INTERNAL_SERVER_ERROR",
        }}
      />
    );
  }

  const title = person.name ?? person.email ?? person.distinctId ?? person.personId;

  return (
    <Page
      breadcrumbs={[
        {
          title: "People",
          url: `/${organizationSlug}/${projectSlug}/persons`,
        },
        {
          title,
          url: `/${organizationSlug}/${projectSlug}/persons/${distinctId}`,
        },
      ]}
      className="p-0 py-8 pt-3"
    >
      <div className="border-border border-b">
        <div className="mx-auto max-w-6xl pb-10">
          <div className="flex flex-row items-center justify-between">
            <h1 className="font-normal text-3xl tracking-right">{title}</h1>
          </div>
          {person.email && <p className="mt-3 text-muted-foreground">{person.email}</p>}
        </div>
      </div>
      <div className="mx-auto mt-3 max-w-6xl ">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-9">
            <div className="mt-8">
              <Card className="mt-8 gap-0 overflow-hidden pb-0">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <CardTitle className="flex items-center gap-4">Purchases</CardTitle>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Switch
                      checked={showDevelopmentData}
                      onCheckedChange={setShowDevelopmentData}
                    />
                    Development data
                  </label>
                </CardHeader>
                <CardContent className="divide-y divide-border border-border border-t px-0">
                  {showDevelopmentData &&
                    developmentState.data?.subscriptions.map((subscription) => (
                      <div
                        className="flex items-center justify-between gap-4 p-4"
                        key={subscription.id}
                      >
                        <div>
                          <div className="flex items-center gap-2 font-medium">
                            {subscription.productName}
                            <Badge variant="outline">Development</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Subscription · status {subscription.status}
                            {subscription.expiresAt
                              ? ` · expires ${format(subscription.expiresAt, "MMM d, yyyy")}`
                              : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyAction("renew", "subscription", subscription.id)}
                          >
                            Renew
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              applyAction("grace_period", "subscription", subscription.id)
                            }
                          >
                            Grace period
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyAction("expire", "subscription", subscription.id)}
                          >
                            Expire
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => applyAction("revoke", "subscription", subscription.id)}
                          >
                            Revoke
                          </Button>
                        </div>
                      </div>
                    ))}
                  {showDevelopmentData &&
                    developmentState.data?.purchases.map((purchase) => (
                      <div
                        className="flex items-center justify-between gap-4 p-4"
                        key={purchase.id}
                      >
                        <div>
                          <div className="flex items-center gap-2 font-medium">
                            {purchase.productName}
                            <Badge variant="outline">Development</Badge>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            One-time purchase
                            {purchase.refundedAt ? " · refunded" : ""}
                            {purchase.revokedAt ? " · revoked" : ""}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => applyAction("refund", "purchase", purchase.id)}
                          >
                            Refund
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => applyAction("revoke", "purchase", purchase.id)}
                          >
                            Revoke
                          </Button>
                        </div>
                      </div>
                    ))}
                  {!showDevelopmentData && (
                    <div className="flex h-full flex-col items-center justify-center py-6">
                      <div className="text-muted-foreground">
                        Person has not made any purchases.
                      </div>
                    </div>
                  )}
                  {showDevelopmentData &&
                    !developmentState.isPending &&
                    !developmentState.data?.subscriptions.length &&
                    !developmentState.data?.purchases.length && (
                      <div className="flex h-full flex-col items-center justify-center py-6">
                        <div className="text-muted-foreground">
                          Person has not made any development purchases.
                        </div>
                      </div>
                    )}
                </CardContent>
              </Card>

              <div className="mt-8">
                <Card className="mt-8 gap-0 overflow-hidden pb-0">
                  <CardHeader className="pb-4">
                    <CardTitle className="flex items-center gap-4">Unlocked Perks</CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-border border-border border-t px-0">
                    {showDevelopmentData &&
                      developmentState.data?.grants.map((grant) => (
                        <div className="flex items-center justify-between p-4" key={grant.id}>
                          <span className="font-medium">{grant.perkId}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">Development</Badge>
                            <Badge variant={grant.status === 1 ? "default" : "secondary"}>
                              {grant.status === 1 ? "Active" : "Expired"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    {!showDevelopmentData && (
                      <div className="flex h-full flex-col items-center justify-center py-6">
                        <div className="text-muted-foreground">Person has no unlocked perks.</div>
                      </div>
                    )}
                    {showDevelopmentData &&
                      !developmentState.isPending &&
                      !developmentState.data?.grants.length && (
                        <div className="flex h-full flex-col items-center justify-center py-6">
                          <div className="text-muted-foreground">
                            Person has no development perks.
                          </div>
                        </div>
                      )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
          <div className="col-span-3 mt-8">
            <h2 className=" font-semibold text-xl tracking-normal tracking-right">Details</h2>
            <div className="mt-4">
              {person.createdAt && (
                <div>
                  <p className="font-semibold">Created at</p>
                  <div className="mt-1 flex flex-row items-center gap-2">
                    <Clock4Icon className="h-4 w-4 text-muted-foreground" />
                    <p className="text-muted-foreground">
                      {format(person.createdAt, "MMM d, yyyy")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
};
