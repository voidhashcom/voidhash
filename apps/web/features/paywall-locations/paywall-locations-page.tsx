import { Card } from '@voidhash/ui';
import { Effect, Either } from 'effect';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { NotFoundError } from '@/lib/effect/errors';
import {
  encodeNextjsErrorResponse,
  HandleCommonErrors,
  ServerComponent
} from '@/lib/effect/runtimes/nextjs';
import { AuthService, AuthSession } from '@/lib/services/auth.service';
import {
  Environment,
  EnvironmentService
} from '@/lib/services/environment.service';
import { PaywallService } from '@/lib/services/paywall.service';
import { PaywallLocationService } from '@/lib/services/paywall-location.service';
import { ProjectService } from '@/lib/services/project.service';
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
      Effect.gen(function* () {
        const authService = yield* AuthService;
        const projectService = yield* ProjectService;
        const paywallLocationService = yield* PaywallLocationService;
        const paywallService = yield* PaywallService;
        const environmentService = yield* EnvironmentService;
        const authSession = yield* authService.authenticateWithSession();
        return yield* AuthSession.provide(authSession)(
          Effect.gen(function* () {
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
                const paywallLocations =
                  yield* paywallLocationService.getPaywallLocations(project.id);
                return { project, paywalls, paywallLocations };
              })
            );
          })
        );
      }).pipe(HandleCommonErrors)
    );

    if (Either.isLeft(data)) {
      const error = data.left;
      return <VoidhashErrorCard error={encodeNextjsErrorResponse(error)} />;
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
