import {
  authenticateWithSession,
  OrganizationService
} from '@voidhash/core/services';
import { Effect, Either } from 'effect';
import { VoidhashErrorCard } from '@/features/shell/components/voidhash-error-card';
import { headers } from '@/lib/effect/headers';
import { ServerComponent } from '@/lib/nextjs-runtime';
import { SettingsGeneralLayout } from './settings-general-layout';
import { TeamDelete } from './team-delete';
import { TeamNameForm } from './team-name';

export const _SettingsGeneralPage = Effect.fn('SettingsGeneralPage')(
  function* ({ params }: { params: { organizationSlug: string } }) {
    const { organizationSlug } = params;
    const data = yield* Effect.either(
      authenticateWithSession(yield* headers)(
        Effect.gen(function* () {
          const organizationService = yield* OrganizationService;
          const activeOrganization =
            yield* organizationService.getOrganizationBySlug(organizationSlug);

          return { activeOrganization };
        })
      )
    );

    if (Either.isLeft(data)) {
      return (
        <VoidhashErrorCard
          error={{
            code: 'INTERNAL_SERVER_ERROR',
            message: 'An error occured loading the organization'
          }}
        />
      );
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
