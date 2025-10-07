import {
  authenticateWithSession,
  PaywallService,
  ProjectNotFoundError,
  ProjectService,
  withEnvironmentFromCookie
} from '@voidhash/core/services';
import { Card } from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { Page } from '@/features/shell';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { headers } from '@/lib/effect/headers';
import { ServerComponent } from '@/lib/nextjs-runtime';
import { CreatePaywallModalButton } from './create-paywall-modal-button';
import { PaywallRecord } from './paywall-record';
import { PaywallsPageEmptyState } from './paywalls-page-empty-state';

export const _PaywallsPage = Effect.fn('PaywallsPage')(function* ({
  organizationSlug,
  projectSlug
}: {
  organizationSlug: string;
  projectSlug: string;
}) {
  const data = yield* Effect.either(
    authenticateWithSession(yield* headers)(
      withEnvironmentFromCookie({ organizationSlug, projectSlug })(
        Effect.gen(function* () {
          const projectService = yield* ProjectService;
          const paywallService = yield* PaywallService;
          const project =
            yield* projectService.getProjectBySlugAndOrganizationSlug({
              organizationSlug,
              projectSlug
            });
          if (!project) {
            return yield* Effect.fail(
              new ProjectNotFoundError({
                message: 'Project not found'
              })
            );
          }
          const paywalls = yield* paywallService.getPaywalls(project.id);
          return { project, paywalls };
        })
      )
    )
  );

  if (Either.isLeft(data)) {
    return (
      <VoidhashErrorCard
        error={{
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occured loading the paywalls'
        }}
      />
    );
  }

  const { project, paywalls } = data.right;

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
});

export const PaywallsPage = ServerComponent.build(_PaywallsPage);
