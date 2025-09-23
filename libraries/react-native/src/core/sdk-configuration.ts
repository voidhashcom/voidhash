import { Context } from 'effect';

export class SdkConfiguration extends Context.Tag(
  'rn-voidhash/SdkConfiguration'
)<
  SdkConfiguration,
  {
    readonly baseUrl: string;
    readonly publishableKey: string;
  }
>() {}
