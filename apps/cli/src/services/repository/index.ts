import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";

const make = Effect.sync(() => ({}));

type RepositoryServiceShape = Effect.Success<typeof make>;

export class RepositoryService extends Context.Service<RepositoryService, RepositoryServiceShape>()(
  "voidhash-cli/services/RepositoryService",
) {
  static Default = Layer.effect(RepositoryService, make);
}
