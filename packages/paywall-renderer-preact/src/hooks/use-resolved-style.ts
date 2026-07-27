import type { NodeState } from "@voidhash/paywall-renderer-web-core";
import { resolveStyle } from "@voidhash/paywall-renderer-web-core";
import { useMemo } from "preact/hooks";

import { usePaywallContext } from "../context/paywall-context";

export function useResolvedStyle<TStyle extends Record<string, unknown>>(
  nodeId: string,
  baseStyle: TStyle,
  states: ReadonlyArray<{ value: NodeState }>,
): TStyle {
  const { getNodeVariables } = usePaywallContext();
  const variables = getNodeVariables(nodeId);
  return useMemo(() => resolveStyle(baseStyle, states, variables), [baseStyle, states, variables]);
}
