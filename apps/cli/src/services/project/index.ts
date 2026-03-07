import { Effect, Layer, ServiceMap } from "effect";

const make = Effect.gen(function* scoped() {
  return {} as const;
});

type ProjectServiceShape = Effect.Success<typeof make>;

export class ProjectService extends ServiceMap.Service<ProjectService, ProjectServiceShape>()(
  "voidhash-cli/services/ProjectService"
) {
  static Default = Layer.effect(ProjectService, make)
}
