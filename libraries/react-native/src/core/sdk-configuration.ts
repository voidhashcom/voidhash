import { Context } from "effect";
import type { UnifiedMeasurementRuntime } from "./measurement/runtime";

export class SdkConfiguration extends Context.Service<
  SdkConfiguration,
  {
    readonly baseUrl: string;
    readonly debug: boolean;
    readonly ingestUrl: string | undefined;
    readonly publishableKey: string;
    readonly readOnly: boolean;
    readonly measurementRuntime: UnifiedMeasurementRuntime;
  }
>()("rn-voidhash/SdkConfiguration") {}
