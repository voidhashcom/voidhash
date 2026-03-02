import { Effect, Layer, ServiceMap } from "effect";

const make = Effect.gen(function* scoped() {
  return {} as const;
});

type CliConfigServiceShape = Effect.Success<typeof make>;

export class CliConfigService extends ServiceMap.Service<CliConfigService, CliConfigServiceShape>()(
  "voidhash-cli/services/CliConfigService"
) {
  static Default = Layer.effect(CliConfigService, make)
}
