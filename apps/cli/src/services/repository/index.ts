import { Effect, Layer, ServiceMap } from "effect";

const make = Effect.gen(function* scoped() {
  return {} as const;
});

type RepositoryServiceShape = Effect.Success<typeof make>;

export class RepositoryService extends ServiceMap.Service<RepositoryService, RepositoryServiceShape>()(
  "voidhash-cli/services/RepositoryService"
) {
  static Default = Layer.effect(RepositoryService, make)
}
