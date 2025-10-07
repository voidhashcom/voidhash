import { HttpApiBuilder } from '@effect/platform';
import { VoidhashV1Api } from '@voidhash/api-spec';
import { OrganizationService } from '@voidhash/core/services';
import { Effect } from 'effect';

export const OrganizationsGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  'organizations',
  (handlers) =>
    Effect.gen(function* () {
      const organizationService = yield* OrganizationService;
      return handlers.handle('createOrganization', ({ payload }) =>
        organizationService.createOrganization({
          name: payload.name
        })
      );
    })
);
