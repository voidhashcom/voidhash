import * as Context from "effect/Context";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";

export type RequestEnvironmentName = "production" | "development" | "all";

export const RequestEnvironmentModeValue = Schema.Struct({
  name: Schema.Literals(["production", "development", "all"]),
  providerEnvironments: Schema.Array(Schema.Literals([1, 2, 3])),
});
export type RequestEnvironmentModeValue = typeof RequestEnvironmentModeValue.Type;

const productionMode: typeof RequestEnvironmentModeValue.Type = {
  name: "production",
  providerEnvironments: [1, 2],
};

/** Resolves the request environment header to the provider environments visible to a request. */
export const resolveRequestEnvironmentMode = (
  value: string | typeof Schema.Undefined.Type,
): typeof RequestEnvironmentModeValue.Type =>
  Match.value(value).pipe(
    Match.when("development", () =>
      RequestEnvironmentModeValue.make({ name: "development", providerEnvironments: [3] }),
    ),
    Match.when("all", () =>
      RequestEnvironmentModeValue.make({ name: "all", providerEnvironments: [1, 2, 3] }),
    ),
    Match.orElse(() => productionMode),
  );

/** Per-request environment scope. Unannotated requests are production-scoped. */
export const RequestEnvironmentMode = Context.Reference<typeof RequestEnvironmentModeValue.Type>(
  "@voidhash/core-v2/purchases/RequestEnvironmentMode",
  { defaultValue: () => productionMode },
);
