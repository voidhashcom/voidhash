import type { DefinedPerks, DefinedProviders } from "./types";

export function paymentProviders<TConfig extends DefinedProviders>(
  config: TConfig
): Readonly<TConfig> {
  return config;
}

export function definePerks<TConfig extends DefinedPerks>(
  config: TConfig
): Readonly<TConfig> {
  return config;
}
