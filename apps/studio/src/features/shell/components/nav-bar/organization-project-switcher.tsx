'use client';
import { Link } from '@tanstack/react-router';
import type { User } from '@voidhash/api-spec';
import {
  Button,
  cn,
  GradientAvatar,
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@voidhash/ui';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import * as React from 'react';
import { CreateOrganizationModal } from '../../../organizations/create-organization-modal';
import { CreateProjectModal } from '../../../projects/create-project-modal';

type UserType = typeof User.Type;

function OrganizationProjectSwitcherProjects({
  organizationId,
  organizationSlug,
  activeProjectId,
  projects,
  onProjectClick
}: {
  organizationId: string;
  organizationSlug: string;
  activeProjectId?: string;
  projects: UserType['projects'];
  onProjectClick?: () => void;
}) {
  // Create project modal
  const [createProjectModalOpen, setCreateProjectModalOpen] =
    React.useState(false);

  return (
    <div className="w-56 bg-accent/30">
      <div className="px-2 py-1.5 text-muted-foreground text-xs">Projects</div>
      {(projects ?? []).map((project) => (
        <Link
          className="flex w-full items-center gap-2 p-2 text-foreground text-sm hover:bg-accent hover:text-accent-foreground"
          key={project.id}
          onClick={onProjectClick}
          params={{ organizationSlug, projectSlug: project.slug }}
          to="/$organizationSlug/$projectSlug"
        >
          <GradientAvatar
            alt={project.name}
            className="h-6 w-6 rounded-lg text-xs"
            fallback={project.id}
            src={undefined}
          />
          {project.name}
          {project.id === activeProjectId && (
            <Check className="ml-auto h-4 w-4" />
          )}
        </Link>
      ))}
      <div className="h-px bg-border" />
      <CreateProjectModal
        onClose={() => setCreateProjectModalOpen(false)}
        open={createProjectModalOpen}
        organizationId={organizationId}
        organizationSlug={organizationSlug}
        trigger={
          <button
            className="flex w-full cursor-pointer items-center gap-2 p-2 hover:bg-accent hover:text-accent-foreground"
            onClick={() => setCreateProjectModalOpen(true)}
            type="button"
          >
            <div className="flex size-6 items-center justify-center rounded-md border bg-background">
              <Plus className="size-4 text-muted-foreground" />
            </div>
            <div className="text-sm">Add project</div>
          </button>
        }
      />
    </div>
  );
}

export function OrganizationProjectSwitcher({
  user,
  activeProject,
  activeOrganization
}: {
  user: {
    projects: UserType['projects'];
    organizations: UserType['organizations'];
  };
  activeProject: UserType['projects'][number] | null;
  activeOrganization: UserType['organizations'][number];
}) {
  const [open, setOpen] = React.useState(false);
  const me = user;

  const organizations = me?.organizations ?? [];

  // Highlight organization
  const [highlightedOrganizationIndex, setHighlightedOrganizationIndex] =
    React.useState<number | null>(null);
  const highlightedOrganization =
    highlightedOrganizationIndex !== null
      ? organizations[highlightedOrganizationIndex]
      : null;

  const [createOrganizationModalOpen, setCreateOrganizationModalOpen] =
    React.useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className="px-1 focus-visible:ring-0 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          size={'icon'}
          variant={'ghost'}
        >
          <ChevronsUpDown className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] min-w-56 rounded-lg p-0"
        side={'bottom'}
        sideOffset={4}
      >
        {activeOrganization && (
          // biome-ignore lint/a11y/noStaticElementInteractions: visual effect
          // biome-ignore lint/nursery/noNoninteractiveElementInteractions: visual effect
          <div
            className="flex flex-row divide-x divide-border"
            onMouseLeave={() => setHighlightedOrganizationIndex(null)}
          >
            <div className="w-56">
              <div className="px-2 py-1.5 text-muted-foreground text-xs">
                Teams
              </div>
              {organizations.map((organization, index) => (
                <Link
                  className={cn(
                    'flex w-full items-center gap-2 p-2 text-foreground text-sm hover:bg-accent/50 hover:text-accent-foreground',
                    organization.slug ===
                      (highlightedOrganization?.slug ??
                        activeOrganization?.slug) && 'bg-accent/50'
                  )}
                  key={organization.name}
                  onClick={() => setOpen(false)}
                  onMouseEnter={() => setHighlightedOrganizationIndex(index)}
                  params={{ organizationSlug: organization.slug }}
                  to="/$organizationSlug"
                >
                  <GradientAvatar
                    alt={organization.name}
                    className="h-6 w-6 rounded-lg text-xs"
                    fallback={organization.id}
                    src={undefined}
                  />
                  {organization.name}
                  {organization.slug === activeOrganization.slug && (
                    <Check className="ml-auto h-4 w-4" />
                  )}
                </Link>
              ))}
              <div className="h-px bg-border" />
              <CreateOrganizationModal
                onClose={() => setCreateOrganizationModalOpen(false)}
                open={createOrganizationModalOpen}
                trigger={
                  <button
                    className="flex w-full cursor-pointer items-center gap-2 p-2 hover:bg-accent/50 hover:text-accent-foreground"
                    onClick={() => setCreateOrganizationModalOpen(true)}
                    type="button"
                  >
                    <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                      <Plus className="size-4 text-muted-foreground" />
                    </div>
                    <div className=" text-sm">Add team</div>
                  </button>
                }
              />
            </div>
            {(highlightedOrganization || activeProject) && (
              <OrganizationProjectSwitcherProjects
                activeProjectId={activeProject?.id}
                onProjectClick={() => setOpen(false)}
                organizationId={
                  highlightedOrganization?.id ?? activeOrganization.id
                }
                organizationSlug={
                  highlightedOrganization?.slug ??
                  activeOrganization.slug ??
                  '-'
                }
                projects={user.projects.filter(
                  (p) => p.organizationId === highlightedOrganization?.id
                )}
              />
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
