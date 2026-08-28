import { Context, Schema } from "effect";

export type RequestEnvironmentName = "production" | "development" | "all";

export const RequestEnvironmentModeValue = Schema.Struct({
  name: Schema.Literals(["production", "development", "all"]),
  providerEnvironments: Schema.Array(Schema.Literals([1, 2, 3])),
});

const productionMode: typeof RequestEnvironmentModeValue.Type = {
  name: "production",
  providerEnvironments: [1, 2],
};

/** Resolves the request environment header to the provider environments visible to a request. */
export const resolveRequestEnvironmentMode = (
  value: string | undefined,
): typeof RequestEnvironmentModeValue.Type => {
  switch (value) {
    case "development":
      return { name: "development", providerEnvironments: [3] };
    case "all":
      return { name: "all", providerEnvironments: [1, 2, 3] };
    default:
      return productionMode;
  }
};

/** Per-request environment scope. Unannotated requests are production-scoped. */
export const RequestEnvironmentMode = Context.Reference<typeof RequestEnvironmentModeValue.Type>(
  "@voidhash/core-v2/purchases/RequestEnvironmentMode",
  { defaultValue: () => productionMode },
);
