import {
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  GradientAvatar
} from '@voidhash/ui';
import { Effect } from 'effect';
import { EllipsisVerticalIcon } from 'lucide-react';
import Link from 'next/link';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { NotFoundError } from '@/lib/effect/errors';
import { runServerEffect } from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import { OrganizationService } from '@/lib/services/organization.service';
import { ProjectService } from '@/lib/services/project.service';
import { EmptyState } from './empty-state';

export async function ProjectsList({
  organizationSlug
}: {
  organizationSlug: string;
}) {
  const data = await runServerEffect(
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
        Effect.gen(function* () {
          const organizationService = yield* OrganizationService;
          const projectService = yield* ProjectService;
          const [activeOrganization, projects] = yield* Effect.all(
            [
              organizationService.getOrganizationBySlug(organizationSlug).pipe(
                Effect.catchTags({
                  OrganizationNotFound: () =>
                    Effect.fail(
                      new NotFoundError({
                        message: 'Organization not found'
                      })
                    )
                })
              ),
              projectService.getProjectsByOrganizationSlug(organizationSlug)
            ],
            {
              concurrency: 'unbounded'
            }
          );

          return { activeOrganization, organizationProjects: projects };
        })
      );
    })
  );

  if (data.isErr()) {
    const error = data._unsafeUnwrapErr();
    return <VoidhashErrorCard error={error} />;
  }

  const { activeOrganization, organizationProjects } = data.value;

  if (organizationProjects?.length === 0) {
    return (
      <EmptyState
        organizationId={activeOrganization?.id}
        organizationSlug={organizationSlug as string}
      />
    );
  }

  return (
    <Card className="grid gap-0 divide-y p-0">
      {organizationProjects?.map((project) => (
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
