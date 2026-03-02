import { Effect, Layer, ServiceMap } from "effect";

const make = Effect.gen(function* scoped() {
  return {} as const;
});

type OrganizationServiceShape = Effect.Success<typeof make>;

export class OrganizationService extends ServiceMap.Service<OrganizationService, OrganizationServiceShape>()(
  "voidhash-cli/services/OrganizationService"
) {
  static Default = Layer.effect(OrganizationService, make)
}
