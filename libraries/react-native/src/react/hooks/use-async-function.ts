import type { Result } from "better-result";
import { Cause, Effect, Exit } from "effect";
import { useCallback, useEffect, useReducer, useRef } from "react";

import type { VoidhashError } from "../../errors";
import { UnknownVoidhashError } from "../../errors";

interface State<T> {
  data?: T | undefined;
  error?: VoidhashError | undefined;
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
  const cancelRequest = useRef<boolean>(false);

  const initialState: State<T> = {
    data: undefined,
    error: undefined,
    isLoading: false,
  };

  // Keep state logic separated
  const asyncFnReducer = (state: State<T>, action: Action<T>): State<T> => {
    switch (action.type) {
      case "loading": {
        return { ...initialState, isLoading: true };
      }
      case "executed": {
        return { ...initialState, data: action.payload, isLoading: false };
      }
      case "error": {
        return { ...initialState, error: action.payload, isLoading: false };
      }
      default: {
        return state;
      }
    }
  };

  const [state, dispatch] = useReducer(asyncFnReducer, initialState);

  const executeAsyncFunction = useCallback(async () => {
    cancelRequest.current = false;
    dispatch({ type: "loading" });

    const exit = await Effect.runPromise(
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
      payload: new UnknownVoidhashError(
        unexpected instanceof Error ? unexpected : new Error(String(unexpected)),
      ),
      type: "error",
    });
  }, [asyncFn]);

  const refetch = useCallback(async () => {
    await executeAsyncFunction();
  }, [executeAsyncFunction]);

  useEffect(() => {
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
