import { Effect, Either } from 'effect';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { NotFoundError } from '@/lib/effect/errors';
import {
  encodeNextjsErrorResponse,
  HandleCommonErrors,
  ServerComponent
} from '@/lib/effect/runtimes/nextjs';
import { authenticateWithSession } from '@/lib/services/auth.service';
import { OrganizationService } from '@/lib/services/organization.service';
import { SettingsGeneralLayout } from './settings-general-layout';
import { TeamDelete } from './team-delete';
import { TeamNameForm } from './team-name';

export const _SettingsGeneralPage = Effect.fn('SettingsGeneralPage')(
  function* ({ params }: { params: { organizationSlug: string } }) {
    const { organizationSlug } = params;
    const data = yield* Effect.either(
      authenticateWithSession(
        Effect.gen(function* () {
          const organizationService = yield* OrganizationService;
          const activeOrganization = yield* organizationService
            .getOrganizationBySlug(organizationSlug)
            .pipe(
              Effect.catchTags({
                OrganizationNotFound: () =>
                  Effect.fail(
                    new NotFoundError({
                      message: 'Organization not found'
                    })
                  )
              })
            );

          return { activeOrganization };
        })
      ).pipe(HandleCommonErrors)
    );

    if (Either.isLeft(data)) {
      const error = data.left;
      return <VoidhashErrorCard error={encodeNextjsErrorResponse(error)} />;
    }

    const { activeOrganization } = data.right;

    return (
      <SettingsGeneralLayout>
        <TeamNameForm
          key={organizationSlug}
          organization={activeOrganization}
        />
        {/* <TeamUrlForm /> */}
        <TeamDelete organizationId={activeOrganization.id} />
      </SettingsGeneralLayout>
    );
  }
);

export const SettingsGeneralPage = ServerComponent.build(_SettingsGeneralPage);
