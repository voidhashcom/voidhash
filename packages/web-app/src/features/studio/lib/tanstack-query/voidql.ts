import { VoidhashRpc, eq } from "../effect-query";
import { queryKeys } from "./query-keys";

/**
 * Execute a VoidQL query. Modelled as a mutation (not a query) because it is
 * triggered imperatively by the "Run" button rather than on mount — the tenant
 * scope is applied server-side, so the client only sends the org id + query text.
 */
export const runVoidQlQueryOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { organizationId: string; text: string }) =>
      VoidhashRpc.request((rpc) => rpc.RunVoidQlQuery(variables)),
    mutationKey: ["runVoidQlQuery"],
  });

/** Save a validated VoidQL query for reuse. */
export const saveVoidQlInsightOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { name: string; organizationId: string; text: string }) =>
      VoidhashRpc.request((rpc) => rpc.SaveVoidQlInsight(variables)),
    mutationKey: ["saveVoidQlInsight"],
  });

/** List saved VoidQL queries for an organization. */
export const listVoidQlInsightsOptions = (options: { organizationId: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListVoidQlInsights(options)),
    queryKey: queryKeys.analytics.voidQlInsights(options),
  });

/** Execute a saved query after recompiling it against the current catalog. */
export const runSavedVoidQlInsightOptions = (variables: { id: string }) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.RunSavedVoidQlInsight(variables)),
    queryKey: ["runSavedVoidQlInsight", variables] as const,
  });

/** Delete a saved VoidQL query. */
export const deleteVoidQlInsightOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { id: string }) =>
      VoidhashRpc.request((rpc) => rpc.DeleteVoidQlInsight(variables)),
    mutationKey: ["deleteVoidQlInsight"],
  });
