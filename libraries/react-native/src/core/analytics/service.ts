import { Effect, Layer, ServiceMap } from "effect";


export class AnalyticsService extends ServiceMap.Service<AnalyticsService>()("voidhash-react-native/AnalyticsService", {
  make: Effect.gen(function* () {

    // const config = yield* Config;
    // return { log: (msg: string) => Effect.log(`[${config.prefix}] ${msg}`) };
  }),
}) {
  // Build the layer yourself from the make effect
  static readonly layer = Layer.effect(this, this.make);
}