import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";

const make = Effect.sync(() => ({}));

type OrganizationServiceShape = Effect.Success<typeof make>;

export class OrganizationService extends Context.Service<
  OrganizationService,
  OrganizationServiceShape
>()("voidhash-cli/services/OrganizationService") {
  static Default = Layer.effect(OrganizationService, make);
}
