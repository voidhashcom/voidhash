import {
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  GradientAvatar
} from '@voidhash/ui';
import { useCurrentUser } from 'hooks/tanstack-query';
import { EllipsisVerticalIcon } from 'lucide-react';
import Link from 'next/link';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { EmptyState } from './empty-state';
import { ProjectsSkeleton } from './projects-skeleton';

export const ProjectsList = ({
  organizationSlug
}: {
  organizationSlug: string;
}) => {
  const { data: currentUser, status: currentUserStatus } = useCurrentUser();

  if (currentUserStatus === 'pending') {
    return <ProjectsSkeleton />;
  }

  if (currentUserStatus === 'error') {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the projects'
        }}
      />
    );
  }

  if (currentUser) {
    const activeOrganization = currentUser.organizations.find(
      (organization) => organization.slug === organizationSlug
    );
    if (!activeOrganization) {
      return (
        <VoidhashErrorCard
          error={{
            code: 'NOT_FOUND',
            message: 'Organization not found'
          }}
        />
      );
    }
    const projects = currentUser.projects.filter(
      (project) => project.organizationId === activeOrganization?.id
    );
    if (projects.length === 0) {
      return (
        <EmptyState
          organizationId={activeOrganization?.id}
          organizationSlug={organizationSlug}
        />
      );
    }
    return (
      <Card className="grid gap-0 divide-y p-0">
        {projects?.map((project) => (
          <div
            className="group relative isolate px-6 py-4 hover:bg-accent/30"
            key={project.id}
          >
            <Link
              className="absolute inset-0 h-full w-full"
              href={`/${organizationSlug}/${project.slug}`}
            />
            <div className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <GradientAvatar
                  alt={project.name}
                  className="h-8 w-8 rounded-lg text-xs"
                  fallback={project.id}
                  src={undefined}
                />
                <div className="flex flex-col">
                  <p>{project.name}</p>
                  <p className="mt-1 text-muted-foreground text-sm">
                    No URL specified
                  </p>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="z-20" size="icon" variant="outline">
                    <EllipsisVerticalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link
                      href={`/${organizationSlug}/${project.slug}/settings/general`}
                    >
                      Settings
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </Card>
    );
  }
};
