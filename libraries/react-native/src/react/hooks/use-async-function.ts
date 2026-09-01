import type { Result } from "better-result";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as EffectRuntime from "effect/Effect";
import * as Exit from "effect/Exit";
import * as React from "react";

import type { VoidhashError } from "../../errors";
import { UnknownVoidhashError } from "../../errors";

interface State<T> {
  data?: T;
  error?: VoidhashError;
  isLoading: boolean;
}

// discriminated union type
type Action<T> =
  | { type: "loading" }
  | { type: "executed"; payload: T }
  | { type: "error"; payload: VoidhashError };

interface UseAsyncFunctionOptions {
  enabled?: boolean;
}

type UseAsyncFunctionReturn<T> = State<T> & {
  refetch: () => Promise<void>;
};

/**
 * Drives a `Promise<Result<T, VoidhashError>>` client call as hook state.
 * The `Err` channel becomes `error`; unexpected exceptions are normalized
 * into an `Err`-shaped state as well.
 */
function useAsyncFunction<T = unknown>(
  asyncFn: () => Promise<Result<T, VoidhashError>>,
  options?: UseAsyncFunctionOptions,
): UseAsyncFunctionReturn<T> {
  // Used to prevent state update if the component is unmounted
  const cancelRequest = React.useRef<boolean>(false);

  const initialState: State<T> = {
    isLoading: false,
  };

  // Keep state logic separated
  const asyncFnReducer = (state: State<T>, action: Action<T>): State<T> => {
    if (action.type === "loading") return { ...initialState, isLoading: true };
    if (action.type === "executed") {
      return { ...initialState, data: action.payload, isLoading: false };
    }
    if (action.type === "error") {
      return { ...initialState, error: action.payload, isLoading: false };
    }
    return state;
  };

  const [state, dispatch] = React.useReducer(asyncFnReducer, initialState);

  const executeAsyncFunction = React.useCallback(async () => {
    cancelRequest.current = false;
    dispatch({ type: "loading" });

    const exit = await EffectRuntime.runPromise(
      Effect.exit(Effect.tryPromise({ try: () => asyncFn(), catch: (error) => error })),
    );

    if (cancelRequest.current) {
      return;
    }

    if (Exit.isSuccess(exit)) {
      const result = exit.value;
      if (result.isOk()) {
        dispatch({ payload: result.value, type: "executed" });
      } else {
        dispatch({ payload: result.error, type: "error" });
      }
      return;
    }

    const unexpected = Cause.squash(exit.cause);
    dispatch({
      payload: new UnknownVoidhashError(unexpected),
      type: "error",
    });
  }, [asyncFn]);

  const refetch = React.useCallback(async () => {
    await executeAsyncFunction();
  }, [executeAsyncFunction]);

  React.useEffect(() => {
    if (!options?.enabled) {
      return;
    }

    void executeAsyncFunction();

    // Use the cleanup function for avoiding a possibly...
    // ...state update after the component was unmounted
    return () => {
      cancelRequest.current = true;
    };
  }, [executeAsyncFunction, options?.enabled]);

  return {
    ...state,
    refetch,
  };
}

export default useAsyncFunction;
