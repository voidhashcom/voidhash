import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

// The wire `manifest` field stays `unknown` here — the designer feature layer
// decodes it with `ComponentManifestSchema` from `@voidhash/core`.
export const listPaywallComponentsOptions = (options: { projectId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListPaywallComponents(options)),
    queryKey: queryKeys.paywallComponent.list(options),
  });

export const getPaywallComponentVersionsOptions = (options: {
  projectId: string;
  refs: ReadonlyArray<{ slug: string; version: number }>;
}) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.GetPaywallComponentVersions(options)),
    queryKey: queryKeys.paywallComponent.versions(options),
  });
