import * as Layer from "effect/Layer";
import * as Context from "effect/Context";

import { BrowserPlatformProvider } from "./browser-platform-provider";

export class PlatformProvider extends Context.Service<PlatformProvider, BrowserPlatformProvider>()(
  "web-voidhash/PlatformProvider",
) {}

export const BrowserPlatformProviderLayer = Layer.succeed(
  PlatformProvider,
  new BrowserPlatformProvider(),
);
