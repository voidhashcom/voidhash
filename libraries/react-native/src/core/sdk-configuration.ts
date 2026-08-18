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
    readonly readOnly: boolean;
  }
>()("rn-voidhash/SdkConfiguration") {}
