'use client';

import { Link } from '@tanstack/react-router';
import type { User } from '@voidhash/api-spec';
import { GradientAvatar } from '@voidhash/ui';
import { useAuth } from 'src/components/auth-context';
import { NavSlashSeparator } from './nav-slash-separator';
import { OrganizationProjectSwitcher } from './organization-project-switcher';

const ProjectTitle = ({
  project
}: {
  project: (typeof User.Type)['projects'][number];
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
        <Link
          params={{
            organizationSlug: organizationSlug ?? '',
            projectSlug: projectSlug ?? ''
          }}
          to="/$organizationSlug/$projectSlug"
        >
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
  const { user } = useAuth();

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
};
