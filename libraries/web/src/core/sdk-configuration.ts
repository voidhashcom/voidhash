import { ServiceMap } from "effect";

import type { ResolvedVoidhashConfig } from "../types";

export class SdkConfiguration extends ServiceMap.Service<
  SdkConfiguration,
  ResolvedVoidhashConfig
>()("web-voidhash/SdkConfiguration") {}
