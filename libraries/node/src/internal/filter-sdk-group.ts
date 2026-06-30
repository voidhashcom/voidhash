export type FilterSdkGroup<TClient> = TClient extends { readonly sdk: unknown }
  ? Omit<TClient, "sdk">
  : TClient;

export const filterSdkGroup = <TClient extends object>(
  client: TClient,
): FilterSdkGroup<TClient> => {
  const { sdk: _sdk, ...filteredClient } = client as TClient & {
    readonly sdk?: unknown;
  };

  return filteredClient as FilterSdkGroup<TClient>;
};
