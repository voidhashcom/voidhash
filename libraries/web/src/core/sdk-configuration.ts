import * as Context from "effect/Context";

import type { ResolvedVoidhashConfig } from "../types";

export class SdkConfiguration extends Context.Service<SdkConfiguration, ResolvedVoidhashConfig>()(
  "web-voidhash/SdkConfiguration",
) {}
