import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Context from "effect/Context";

const make = Effect.sync(() => ({}));

type CliConfigServiceShape = Effect.Success<typeof make>;

export class CliConfigService extends Context.Service<CliConfigService, CliConfigServiceShape>()(
  "voidhash-cli/services/CliConfigService",
) {
  static Default = Layer.effect(CliConfigService, make);
}
