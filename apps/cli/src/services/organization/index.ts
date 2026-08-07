import { Effect, Layer, Context } from "effect";

const make = Effect.sync(() => ({}));

type OrganizationServiceShape = Effect.Success<typeof make>;

export class OrganizationService extends Context.Service<
  OrganizationService,
  OrganizationServiceShape
>()("voidhash-cli/services/OrganizationService") {
  static Default = Layer.effect(OrganizationService, make);
}
