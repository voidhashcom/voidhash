import { Context } from "effect";

export class SdkConfiguration extends Context.Tag(
  "rn-voidhash/SdkConfiguration"
)<
  SdkConfiguration,
  {
    readonly baseUrl: string;
    readonly debug: boolean;
    readonly ingestUrl: string | undefined;
    readonly publishableKey: string;
    readonly readOnly: boolean;
  }
>() {}
