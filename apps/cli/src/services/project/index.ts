import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";

const make = Effect.sync(() => ({}));

type ProjectServiceShape = Effect.Success<typeof make>;

export class ProjectService extends Context.Service<ProjectService, ProjectServiceShape>()(
  "voidhash-cli/services/ProjectService",
) {
  static Default = Layer.effect(ProjectService, make);
}
