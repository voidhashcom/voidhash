import { Context } from "effect";

export class SdkConfiguration extends Context.Service<
  SdkConfiguration,
  {
    readonly baseUrl: string;
    readonly debug: boolean;
    readonly developmentMode: boolean;
    readonly environmentMode: "production" | "development";
    readonly ingestUrl: string | undefined;
    readonly publishableKey: string;
    /**
     * Observer mode: the SDK watches store transactions but never claims
     * ownership of them. Mutable at runtime through `client.setReadOnly()`, so
     * consumers must read this property at the decision point rather than
     * destructuring it when their layer is built.
     */
    readonly readOnly: boolean;
  }
>()("rn-voidhash/SdkConfiguration") {}

export interface SdkConfigurationValues {
  readonly baseUrl: string;
  readonly debug: boolean;
  readonly developmentMode: boolean;
  readonly ingestUrl: string | undefined;
  readonly publishableKey: string;
  readonly readOnly: boolean;
}

export interface SdkConfigurationHandle {
  /** Reads the current observer-mode flag. */
  readonly isReadOnly: () => boolean;
  /** Value to provide to the {@link SdkConfiguration} layer. */
  readonly service: typeof SdkConfiguration.Service;
  /** Flips observer mode for every consumer reading it after this call. */
  readonly setReadOnly: (readOnly: boolean) => void;
}

/**
 * Builds the {@link SdkConfiguration} service value together with the handle
 * that flips observer mode at runtime.
 *
 * `readOnly` is exposed as a getter over a single mutable cell — unusual for a
 * configuration record, but it is what lets `client.setReadOnly()` reach every
 * consumer (purchase gating, the transaction observer's finish/acknowledge
 * decision, the `x-observer-mode` header) without rebuilding the Effect
 * runtime and losing the caches and native connection it owns.
 */
export const makeSdkConfiguration = (values: SdkConfigurationValues): SdkConfigurationHandle => {
  let readOnly = values.readOnly;

  const service: typeof SdkConfiguration.Service = {
    baseUrl: values.baseUrl,
    debug: values.debug,
    developmentMode: values.developmentMode,
    environmentMode: values.developmentMode ? "development" : "production",
    ingestUrl: values.ingestUrl,
    publishableKey: values.publishableKey,
    get readOnly() {
      return readOnly;
    },
  };

  return {
    isReadOnly: () => readOnly,
    service,
    setReadOnly: (nextReadOnly: boolean) => {
      readOnly = nextReadOnly;
    },
  };
};
