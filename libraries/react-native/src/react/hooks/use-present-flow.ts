import type * as Option from "effect/Option";
import * as React from "react";

import type { VoidhashClient } from "../../client";
import type { FlowResult, PresentFlowArguments } from "../../core/flows/flows";
import type { FlowInput, LocationSlug } from "../../core/schema/registry";
import { type VoidhashContext, useProviderStatus } from "../components/provider";

export function presentFlowHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<Option.Option<VoidhashContext>>,
) {
  /**
   * Presents the flow assigned to `location`. `present(options)` resolves with
   * how the flow ended and rejects with a `VoidhashError` when it cannot be
   * shown; `isPresenting` is `true` while a flow started by this hook is on
   * screen. `updateInput(values)` changes inputs of the flow on screen.
   */
  function usePresentFlow<const L extends LocationSlug>(location: L) {
    useProviderStatus(vhContext, "usePresentFlow");
    const [isPresenting, setIsPresenting] = React.useState(false);

    const present = React.useCallback(
      (...args: PresentFlowArguments<L>): Promise<FlowResult<L>> => {
        setIsPresenting(true);
        return client.presentFlow(location, ...args).finally(() => setIsPresenting(false));
      },
      [location],
    );

    const updateInput = React.useCallback(
      (values: Partial<FlowInput<L>>): Promise<void> => client.updateFlowInput<L>(values),
      [],
    );

    return { isPresenting, present, updateInput };
  }
  return usePresentFlow;
}
