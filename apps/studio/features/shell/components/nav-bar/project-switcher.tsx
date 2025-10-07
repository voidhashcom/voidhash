'use client';

import { Result } from '@effect-atom/atom-react';
import type { User } from '@voidhash/api-spec';
import { GradientAvatar, Skeleton } from '@voidhash/ui';
import { useUser } from 'atom/user';
import type { Schema } from 'effect';
import Link from 'next/link';
import { NavSlashSeparator } from './nav-slash-separator';
import { OrganizationProjectSwitcher } from './organization-project-switcher';

type UserType = Schema.Schema.Type<typeof User>;

const ProjectTitle = ({
  project
}: {
  project: UserType['projects'][number];
}) => {
  return (
    <div className="flex items-center gap-2">
      <GradientAvatar
        alt={project.name}
        className="h-6 w-6 rounded-lg text-xs"
        fallback={project.id}
        src={undefined}
      />

      <span className="truncate text-foreground- text-sm">{project.name}</span>
    </div>
  );
};

const ProjectTitleSkeleton = () => {
  return (
    <div className="flex items-center gap-2">
      <Skeleton className="h-6 w-6 rounded-full" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
};

const ProjectSwitcherShell = ({
  organizationSlug,
  projectSlug,
  projectTitle,
  children
}: {
  organizationSlug: string | null;
  projectSlug: string | null;
  projectTitle: React.ReactNode;
  children?: React.ReactNode;
}) => {
  if (!projectSlug) {
    return null;
  }
  return (
    <>
      <NavSlashSeparator />
      <div className="flex items-center gap-2">
        <Link href={`/${organizationSlug}/${projectSlug}`}>
          <div className="flex items-center gap-2">{projectTitle}</div>
        </Link>
        {children}
      </div>
    </>
  );
};

export const ProjectSwitcher = ({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string | null;
  projectSlug: string | null;
}) => {
  return useUser().pipe(
    Result.matchWithWaiting({
      onWaiting: () => (
        <ProjectSwitcherShell
          organizationSlug={organizationSlug}
          projectSlug={projectSlug}
          projectTitle={<ProjectTitleSkeleton />}
        />
      ),
      onError: () => (
        <ProjectSwitcherShell
          organizationSlug={organizationSlug}
          projectSlug={projectSlug}
          projectTitle={<ProjectTitleSkeleton />}
        />
      ),
      onDefect: () => (
        <ProjectSwitcherShell
          organizationSlug={organizationSlug}
          projectSlug={projectSlug}
          projectTitle={<ProjectTitleSkeleton />}
        />
      ),
      onSuccess: ({ value: user }) => {
        const activeProject = user.projects.find((p) => p.slug === projectSlug);
        const activeOrganization = user.organizations.find(
          (o) => o.slug === organizationSlug
        );
        const canBeDisplayed = activeProject && activeOrganization;
        if (!canBeDisplayed) {
          return null;
        }
        return (
          <ProjectSwitcherShell
            organizationSlug={organizationSlug}
            projectSlug={projectSlug}
            projectTitle={<ProjectTitle project={activeProject} />}
          >
            <OrganizationProjectSwitcher
              activeOrganization={activeOrganization}
              activeProject={activeProject}
              user={user}
            />
          </ProjectSwitcherShell>
        );
      }
    })
  );
};
