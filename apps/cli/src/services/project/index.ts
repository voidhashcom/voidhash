import { Effect, Layer, Context } from "effect";

const make = Effect.sync(() => ({}));

type ProjectServiceShape = Effect.Success<typeof make>;

export class ProjectService extends Context.Service<ProjectService, ProjectServiceShape>()(
  "voidhash-cli/services/ProjectService",
) {
  static Default = Layer.effect(ProjectService, make);
}
