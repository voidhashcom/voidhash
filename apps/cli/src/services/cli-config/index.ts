import { Effect } from "effect";

export class CliConfigService extends Effect.Service<CliConfigService>()(
  "voidhash-cli/services/CliConfigService",
  {
    dependencies: [],
    scoped: Effect.gen(function* scoped() {
      return {} as const;
    }),
  }
) {}
