import { Effect } from 'effect';

export class ProjectService extends Effect.Service<ProjectService>()(
  'voidhash-cli/services/ProjectService',
  {
    dependencies: [],
    scoped: Effect.gen(function* () {
      return {} as const;
    })
  }
) {}
