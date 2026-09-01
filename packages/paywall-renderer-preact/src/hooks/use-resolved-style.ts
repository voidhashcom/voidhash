import type { NodeState } from "@voidhash/paywall-renderer-web-core";
import { resolveStyle } from "@voidhash/paywall-renderer-web-core";

import { usePaywallContext } from "../context/paywall-context";

export function useResolvedStyle<TStyle extends Record<string, unknown>>(
  nodeId: string,
  baseStyle: TStyle,
  states: ReadonlyArray<{ value: NodeState }>,
): TStyle {
  const { getNodeVariables } = usePaywallContext();
  const variables = getNodeVariables(nodeId);
  return resolveStyle(baseStyle, states, variables);
}
