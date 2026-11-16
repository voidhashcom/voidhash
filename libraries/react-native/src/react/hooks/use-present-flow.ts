import type * as Option from "effect/Option";
import * as React from "react";

import type { VoidhashClient } from "../../client";
import type { FlowResult } from "../../core/flows/flows";
import type { LocationSlug } from "../../core/schema/registry";
import { type VoidhashContext, useProviderStatus } from "../components/provider";

export function presentFlowHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<Option.Option<VoidhashContext>>,
) {
  /**
   * Presents the flow assigned to `placement`. `present()` resolves with how
   * the flow ended and never rejects; `isPresenting` is `true` while a flow
   * started by this hook is on screen.
   */
  function usePresentFlow(placement: LocationSlug) {
    useProviderStatus(vhContext, "usePresentFlow");
    const [isPresenting, setIsPresenting] = React.useState(false);

    const present = React.useCallback((): Promise<FlowResult> => {
      setIsPresenting(true);
      return client.presentFlow(placement).finally(() => setIsPresenting(false));
    }, [placement]);

    return { isPresenting, present };
  }
  return usePresentFlow;
}
