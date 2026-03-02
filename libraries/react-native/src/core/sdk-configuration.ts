import { ServiceMap } from "effect";

export class SdkConfiguration extends ServiceMap.Service<SdkConfiguration, {
    readonly baseUrl: string;
    readonly debug: boolean;
    readonly ingestUrl: string | undefined;
    readonly publishableKey: string;
    readonly readOnly: boolean;
  }>()("rn-voidhash/SdkConfiguration") {}
