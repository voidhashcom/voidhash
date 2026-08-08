"use client";

import { Link, useMatches } from "@tanstack/react-router";
import type { User } from "@voidhash/api-contracts";
import { Button, GradientAvatar } from "@voidhash/ui";
import { useAuth } from "@/features/studio/components/auth-context";

import { ProjectsPicker } from "./organization-project-switcher";

const ProjectTitle = ({ project }: { project: (typeof User.Type)["projects"][number] }) => (
  <div className="flex items-center gap-2">
    <GradientAvatar
      alt={project.name}
      className="h-6 w-6 rounded-lg text-xs"
      fallback={project.id}
      src={project.logo ?? undefined}
    />

    <span className="truncate text-foreground- text-sm">{project.name}</span>
  </div>
);

const useAllProjectsPickerEnabled = () =>
  useMatches({
    select: (matches) => matches.some((m) => m.staticData.allProjectsPicker),
  });

export const ProjectSwitcher = ({
  organizationSlug,
  projectSlug,
}: {
  organizationSlug: string | null;
  projectSlug: string | null;
}) => {
  const { user } = useAuth();
  const allProjectsPickerEnabled = useAllProjectsPickerEnabled();

  const activeProject = user.projects.find((p) => p.slug === projectSlug);
  const activeOrganization = user.organizations.find((o) => o.slug === organizationSlug);
  if (!activeOrganization) {
    return null;
  }

  const picker = (
    <ProjectsPicker
      activeOrganization={activeOrganization}
      activeProject={activeProject ?? null}
      user={user}
    />
  );

  if (activeProject) {
    return (
      <div className="flex items-center">
        <Button variant="ghost" asChild className="pl-1 rounded-l-2xl">
          <Link
            params={{
              organizationSlug: activeOrganization.slug,
              projectSlug: activeProject.slug,
            }}
            to="/studio/$organizationSlug/$projectSlug"
          >
            <ProjectTitle project={activeProject} />
          </Link>
        </Button>
        {picker}
      </div>
    );
  }

  if (allProjectsPickerEnabled) {
    return (
      <div className="flex items-center">
        <div className="flex items-center gap-2 pl-3 pr-2 h-9">
          <span className="truncate text-muted-foreground text-sm">All Projects</span>
        </div>
        {picker}
      </div>
    );
  }

  return null;
};
