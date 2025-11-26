import { Effect } from 'effect';

export class OrganizationService extends Effect.Service<OrganizationService>()(
  'voidhash-cli/services/OrganizationService',
  {
    dependencies: [],
    scoped: Effect.gen(function* () {
      return {} as const;
    })
  }
) {}
