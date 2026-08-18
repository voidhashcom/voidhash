import { Effect } from "effect";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/features/studio/components/auth-context";

import { ProjectAvatarForm } from "@/features/studio/projects/settings/general/project-avatar";
import { ProjectDelete } from "@/features/studio/projects/settings/general/project-delete";
import { ProjectNameForm } from "@/features/studio/projects/settings/general/project-name";
import { ProjectSettingsGeneralLayout } from "@/features/studio/projects/settings/general/project-settings-general-layout";
import { ProjectSettingsGeneralPageSkeleton } from "@/features/studio/projects/settings/general/project-settings-general-page-skeleton";
import { DevelopmentModeSettings } from "@/features/studio/projects/settings/general/development-mode-settings";
import { VoidhashErrorCard } from "@/features/studio/shell/components/voidhash-error-card";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

export const Route = createFileRoute(
  "/studio/_authenticated/_dashboard/_project/$organizationSlug/$projectSlug/settings/",
)({
  component: ProjectSettingsGeneralPage,
  errorComponent: ProjectSettingsGeneralPageError,
  pendingComponent: ProjectSettingsGeneralPageSkeleton,
});

function ProjectSettingsGeneralPageError() {
  return <VoidhashErrorCard error={{ code: "NOT_FOUND", message: "Project not found" }} />;
}

function ProjectSettingsGeneralPage() {
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

  return (
    <ProjectSettingsGeneralLayout>
      <ProjectAvatarForm key={`${projectSlug}-avatar`} project={project} />
      <ProjectNameForm
        key={projectSlug as string}
        projectId={project.id}
        projectName={project.name}
      />
      <DevelopmentModeSettings projectId={project.id} />
      <ProjectDelete projectId={project.id} />
    </ProjectSettingsGeneralLayout>
  );
}
