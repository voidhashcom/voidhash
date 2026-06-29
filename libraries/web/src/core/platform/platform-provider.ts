import { Layer, Context } from "effect";

import { BrowserPlatformProvider } from "./browser-platform-provider";

export class PlatformProvider extends Context.Service<
  PlatformProvider,
  BrowserPlatformProvider
>()("web-voidhash/PlatformProvider") {}

export const BrowserPlatformProviderLayer = Layer.succeed(
  PlatformProvider,
  new BrowserPlatformProvider()
);
