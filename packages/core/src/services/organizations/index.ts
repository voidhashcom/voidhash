import { BetterAuth } from '@voidhash/auth/effect';
import { Effect } from 'effect';
import { createOrganization } from './create-organization';
import { deleteOrganization } from './delete-organization';
import { getOrganizationById } from './get-organization-by-id';
import { getOrganizationBySlug } from './get-organization-by-slug';
import { updateOrganization } from './update-organization';

export class OrganizationService extends Effect.Service<OrganizationService>()(
  'OrganizationService',
  {
    // Specify dependencies
    dependencies: [BetterAuth.Default],
    effect: Effect.gen(function* () {
      return {
        createOrganization: yield* createOrganization,
        getOrganizationBySlug: yield* getOrganizationBySlug,
        getOrganizationById: yield* getOrganizationById,
        deleteOrganization: yield* deleteOrganization,
        updateOrganization: yield* updateOrganization
      } as const;
    })
  }
) {}

