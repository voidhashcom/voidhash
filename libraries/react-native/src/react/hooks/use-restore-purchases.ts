import type { Result } from "better-result";
import type * as Option from "effect/Option";
import * as React from "react";

import type { VoidhashClient } from "../../client";
import type { Person } from "../../core/entities/person";
import type { VoidhashError } from "../../errors";
import { type VoidhashContext, useProviderStatus } from "../components/provider";
import { runHostCallback } from "../internal/host-callback";

/**
 * Callbacks for a restore's outcome. An exception a callback throws (or a
 * promise it returns that rejects) is reported through `onDiagnostic` as
 * `HOST_CALLBACK_FAILED` and never affects the restore or the hook's state.
 */
export interface UseRestorePurchasesOptions {
  /**
   * Runs when the restore finished, with the refreshed person (`null` when
   * there is none). It does not mean the person has access: check their
   * entitlements, which mounted `useHasPerk` hooks already re-render with.
   */
  // oxlint-disable-next-line effect/prefer-option-over-null -- public hook callback consumed by non-Effect app code.
  onSuccess?: (person: Person | null) => void;
  onError?: (error: VoidhashError) => void;
  // oxlint-disable-next-line effect/prefer-option-over-null -- public hook callback consumed by non-Effect app code.
  onSettled?: (result: Result<Person | null, VoidhashError>) => void;
}

export function restorePurchasesHookFactory(
  client: VoidhashClient,
  vhContext: React.Context<Option.Option<VoidhashContext>>,
) {
  /**
   * Restores the current person's purchases, for a Restore button.
   * `restore()` resolves with the result of `client.restorePurchases()`, the
   * refreshed person, and never rejects; `isLoading` is `true` while a
   * restore this hook started runs. `restore` takes no arguments, so it can
   * be passed to `onPress` directly.
   */
  function useRestorePurchases(hookOptions?: UseRestorePurchasesOptions) {
    useProviderStatus(vhContext, "useRestorePurchases");
    const [isLoading, setIsLoading] = React.useState(false);
    // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
    const [error, setError] = React.useState<VoidhashError | null>(null);

    // oxlint-disable-next-line effect/prefer-option-over-null -- public hook answer consumed by non-Effect app code.
    const restore = React.useCallback((): Promise<Result<Person | null, VoidhashError>> => {
      setIsLoading(true);
      setError(null);

      // `restorePurchases` never rejects — every outcome is a Result — and
      // the hook settles before any callback runs, so a callback that throws
      // cannot leave it loading.
      return client.restorePurchases().then((result) => {
        setIsLoading(false);
        if (result.isErr()) setError(result.error);

        const { onError, onSettled, onSuccess } = hookOptions ?? {};
        if (result.isOk() && onSuccess) {
          const person = result.value;
          runHostCallback(client, "useRestorePurchases.onSuccess", () => onSuccess(person));
        }
        if (result.isErr() && onError) {
          runHostCallback(client, "useRestorePurchases.onError", () => onError(result.error));
        }
        if (onSettled) {
          runHostCallback(client, "useRestorePurchases.onSettled", () => onSettled(result));
        }
        return result;
      });
    }, [hookOptions]);

    return {
      /** The error of the last restore, or `null`. */
      error,
      isLoading,
      restore,
    };
  }
  return useRestorePurchases;
}
