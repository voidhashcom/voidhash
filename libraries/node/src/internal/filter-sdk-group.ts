export type FilterSdkGroup<TClient> = TClient extends { readonly sdk: unknown }
  ? Omit<TClient, "sdk">
  : TClient;

export const filterSdkGroup = <TClient extends object>(
  client: TClient & { readonly sdk?: unknown },
): Omit<TClient & { readonly sdk?: unknown }, "sdk"> => {
  const { sdk: _sdk, ...filteredClient } = client;

  return filteredClient;
};
