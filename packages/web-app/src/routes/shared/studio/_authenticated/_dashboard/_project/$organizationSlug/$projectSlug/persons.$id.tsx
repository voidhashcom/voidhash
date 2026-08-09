import { Effect } from "effect";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@voidhash/ui";
import { format } from "date-fns";
import { Clock4Icon } from "lucide-react";
import { useAuth } from "@/features/studio/components/auth-context";

import { PersonFlagOverridesPanel } from "@/features/studio/feature-flags/components/person-detail-page/person-flag-overrides-panel";
import { getPersonByDistinctIdOptions } from "@/features/studio/lib/tanstack-query/persons";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import { Page } from "@/features/studio/shell";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/persons/$id",
)({
  component: PersonDetailPage,
  errorComponent: PersonDetailPageError,
  pendingComponent: PersonDetailPageSkeleton,
});

function PersonDetailPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occurred loading the person",
      }}
    />
  );
}

function PersonDetailPageSkeleton() {
  return <Page className="p-0 py-8 pt-3">Loading person...</Page>;
}

function PersonDetailPage() {
  const { id: distinctId, organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    return Effect.runSync(Effect.die(new Error("Project not found")));
  }

  const { data: person } = useSuspenseQuery(
    getPersonByDistinctIdOptions({
      distinctId: distinctId as string,
      projectId: project.id,
    }),
  );

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
        <div className="mx-auto max-w-6xl pb-10 pt-4">
          <div className="flex flex-row items-center justify-between">
            <h1 className="font-normal text-3xl tracking-right">{title}</h1>
          </div>
          {person.email && <p className="mt-3 text-muted-foreground">{person.email}</p>}
        </div>
      </div>
      <div className="mx-auto mt-3 max-w-6xl ">
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-9">
            <div className="mt-8 space-y-8">
              <Card className="gap-0 overflow-hidden pb-0">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-4">Purchases</CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border border-border border-t px-0">
                  <div className="flex h-full flex-col items-center justify-center py-6">
                    <div className="text-muted-foreground">Person has not made any purchases.</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="gap-0 overflow-hidden pb-0">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center gap-4">Unlocked Perks</CardTitle>
                </CardHeader>
                <CardContent className="divide-y divide-border border-border border-t px-0">
                  <div className="flex h-full flex-col items-center justify-center py-6">
                    <div className="text-muted-foreground">Person has no unlocked perks.</div>
                  </div>
                </CardContent>
              </Card>

              <PersonFlagOverridesPanel personId={person.personId} projectId={project.id} />
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
}
