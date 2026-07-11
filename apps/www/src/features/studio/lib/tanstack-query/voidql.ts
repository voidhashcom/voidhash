import { VoidhashRpc, eq } from "../effect-query";

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
