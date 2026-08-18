import { Effect } from "effect";
import { createFileRoute } from "@tanstack/react-router";

import { useAuth } from "@/features/studio/components/auth-context";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import { ProjectEventsPage } from "@/features/studio/projects/settings/events/project-events-page";
import { SettingsPage } from "@/features/studio/settings";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { SettingsCardSkeleton } from "@voidhash/ui";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/events",
)({
  component: ProjectEventsSettingsPage,
  errorComponent: ProjectEventsSettingsPageError,
  pendingComponent: ProjectEventsSettingsPageSkeleton,
});

function ProjectEventsSettingsPageError() {
  return (
    <VoidhashErrorCard
      error={{
        code: "INTERNAL_SERVER_ERROR",
        message: "An error occured loading the event settings",
      }}
    />
  );
}

function ProjectEventsSettingsPageSkeleton() {
  return (
    <SettingsPage description="Choose which events this project stores." title="Events">
      {Array.from({ length: 2 }).map((_, index) => (
        <SettingsCardSkeleton key={index} />
      ))}
    </SettingsPage>
  );
}

function ProjectEventsSettingsPage() {
  const { organizationSlug, projectSlug } = Route.useParams();
  const { user } = useAuth();
  const project = CurrentUser.getProjectBySlugs(
    user,
    organizationSlug as string,
    projectSlug as string,
  );

  if (!project) {
    return Effect.runSync(Effect.die(new Error("Project not found")));
  }

  return <ProjectEventsPage projectId={project.id} />;
}
