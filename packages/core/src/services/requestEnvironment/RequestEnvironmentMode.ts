import { ProviderEnvironment, type ProviderEnvironmentValue } from "@voidhash/db";
import { Context } from "effect";

export type RequestEnvironmentName = "production" | "development" | "all";

export interface RequestEnvironmentModeValue {
  readonly name: RequestEnvironmentName;
  readonly providerEnvironments: ReadonlyArray<ProviderEnvironmentValue>;
}

const productionMode: RequestEnvironmentModeValue = {
  name: "production",
  providerEnvironments: [ProviderEnvironment.Production, ProviderEnvironment.Sandbox],
};

/** Resolves a request environment header into its allowed provider environments. */
export const resolveRequestEnvironmentMode = (
  value: string | undefined,
): RequestEnvironmentModeValue => {
  switch (value) {
    case "development":
      return {
        name: "development",
        providerEnvironments: [ProviderEnvironment.Development],
      };
    case "all":
      return {
        name: "all",
        providerEnvironments: [
          ProviderEnvironment.Production,
          ProviderEnvironment.Sandbox,
          ProviderEnvironment.Development,
        ],
      };
    default:
      return productionMode;
  }
};

/** Per-request environment scope. Unannotated requests are production-scoped. */
export const RequestEnvironmentMode = Context.Reference<RequestEnvironmentModeValue>(
  "voidhash/RequestEnvironmentMode",
  { defaultValue: () => productionMode },
);
