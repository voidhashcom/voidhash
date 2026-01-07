import { Effect } from "effect";

export class RepositoryService extends Effect.Service<RepositoryService>()(
  "voidhash-cli/services/RepositoryService",
  {
    dependencies: [],
    scoped: Effect.gen(function* scoped() {
      return {} as const;
    }),
  }
) {}
