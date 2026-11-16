import * as Context from "effect/Context";

import { BrowserPlatformProvider } from "./browser-platform-provider";

export class PlatformProvider extends Context.Service<PlatformProvider, BrowserPlatformProvider>()(
  "web-voidhash/PlatformProvider",
) {}

/** Stateless, so every client shares it. */
export const browserPlatformProvider = new BrowserPlatformProvider();
