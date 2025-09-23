import {
  authenticateWithSession,
  PaywallLocationService,
  PaywallService,
  ProjectNotFoundError,
  ProjectService,
  withEnvironmentFromCookie
} from '@voidhash/core/services';
import { Card } from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { headers } from '@/lib/effect/headers';
import { ServerComponent } from '@/lib/nextjs-runtime';
import { CreatePaywallLocationModalButton } from './create-paywall-location-modal-button';
import { PaywallLocationRecord } from './paywall-location-record';
import { PaywallLocationsPageEmptyState } from './paywall-locations-page-empty-state';

export const _PaywallLocationsPage = Effect.fn('PaywallLocationsPage')(
  function* ({
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
            const paywallLocationService = yield* PaywallLocationService;
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
            const paywallLocations =
              yield* paywallLocationService.getPaywallLocations(project.id);
            return { project, paywalls, paywallLocations };
          })
        )
      )
    );

    if (Either.isLeft(data)) {
      return (
        <VoidhashErrorCard
          error={{
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An error occured loading the paywall locations'
          }}
        />
      );
    }

    const { project, paywalls, paywallLocations } = data.right;

    return (
      <div>
        <div className="flex flex-row items-center justify-between pt-6">
          <div>
            <h2 className="font-normal text-xl tracking-right">
              Paywall Locations
            </h2>
            <p className="mt-1 text-muted-foreground">
              Places throughout your app where paywalls can be shown.
            </p>
          </div>
          {paywallLocations.length > 0 && (
            <CreatePaywallLocationModalButton
              paywalls={paywalls}
              projectId={project.id}
            />
          )}
        </div>

        <div className="mt-8">
          {paywallLocations.length === 0 ? (
            <PaywallLocationsPageEmptyState
              paywalls={paywalls}
              projectId={project.id}
            />
          ) : (
            <Card className="grid gap-0 divide-y p-0">
              {paywallLocations.map((paywallLocation) => (
                <PaywallLocationRecord
                  key={paywallLocation.id}
                  organizationSlug={organizationSlug}
                  paywallLocation={paywallLocation}
                  paywalls={paywalls}
                  projectSlug={projectSlug}
                />
              ))}
            </Card>
          )}
        </div>
      </div>
    );
  }
);

export const PaywallLocationsPage = ServerComponent.build(
  _PaywallLocationsPage
);
