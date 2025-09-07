import { Card } from '@voidhash/ui';
import { Effect } from 'effect';
import { Page } from '@/features/shell';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { NotFoundError } from '@/lib/effect/errors';
import { runServerEffect } from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import {
  Environment,
  EnvironmentService
} from '@/lib/services/environment.service';
import { PaywallService } from '@/lib/services/paywall.service';
import { ProjectService } from '@/lib/services/project.service';
import { CreatePaywallModalButton } from './create-paywall-modal-button';
import { PaywallRecord } from './paywall-record';
import { PaywallsPageEmptyState } from './paywalls-page-empty-state';

export async function PaywallsPage({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string;
  projectSlug: string;
}) {
  const data = await runServerEffect(
    Effect.gen(function* () {
      const authService = yield* AuthService;
      const authSession = yield* authService.authenticateWithSession();
      return yield* AuthSession.provide(authSession)(
        Effect.gen(function* () {
          const projectService = yield* ProjectService;
          const paywallService = yield* PaywallService;
          const environmentService = yield* EnvironmentService;
          const environment =
            yield* environmentService.getEnvironmentFromCookie({
              organizationSlug,
              projectSlug
            });
          return yield* Environment.provide(environment)(
            Effect.gen(function* () {
              const project =
                yield* projectService.getProjectBySlugAndOrganizationSlug({
                  organizationSlug,
                  projectSlug
                });
              if (!project) {
                return yield* Effect.fail(
                  new NotFoundError({
                    message: 'Project not found'
                  })
                );
              }
              const paywalls = yield* paywallService.getPaywalls(project.id);
              return { project, paywalls };
            })
          );
        })
      );
    })
  );

  if (data.isErr()) {
    const error = data._unsafeUnwrapErr();
    return <VoidhashErrorCard error={error} />;
  }

  const { project, paywalls } = data.value;

  return (
    <Page>
      {/* Key is used to reload the default form data when the organization slug changes */}
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-row items-center justify-between">
          <h1 className="font-normal text-3xl tracking-right">Paywalls</h1>
          {paywalls.length > 0 && (
            <CreatePaywallModalButton projectId={project.id} />
          )}
        </div>

        <div className="mt-8">
          {paywalls.length === 0 ? (
            <PaywallsPageEmptyState projectId={project.id} />
          ) : (
            <Card className="grid gap-0 divide-y p-0">
              {paywalls.map((paywall) => (
                <PaywallRecord
                  key={paywall.id}
                  organizationSlug={organizationSlug}
                  paywall={paywall}
                  projectSlug={projectSlug}
                />
              ))}
            </Card>
          )}
        </div>
      </div>
    </Page>
  );
}
