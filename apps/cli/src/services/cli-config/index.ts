import { Effect, Layer, Context } from "effect";

const make = Effect.gen(function* scoped() {
  return {} as const;
});

type CliConfigServiceShape = Effect.Success<typeof make>;

export class CliConfigService extends Context.Service<CliConfigService, CliConfigServiceShape>()(
  "voidhash-cli/services/CliConfigService",
) {
  static Default = Layer.effect(CliConfigService, make);
}
