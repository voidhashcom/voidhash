import { Context } from "effect";

import type { ResolvedVoidhashConfig } from "../types";

export class SdkConfiguration extends Context.Service<SdkConfiguration, ResolvedVoidhashConfig>()(
  "web-voidhash/SdkConfiguration",
) {}
