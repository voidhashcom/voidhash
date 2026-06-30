import { Effect, Layer, Context } from "effect";

const make = Effect.gen(function* scoped() {
  return {} as const;
});

type OrganizationServiceShape = Effect.Success<typeof make>;

export class OrganizationService extends Context.Service<
  OrganizationService,
  OrganizationServiceShape
>()("voidhash-cli/services/OrganizationService") {
  static Default = Layer.effect(OrganizationService, make);
}
