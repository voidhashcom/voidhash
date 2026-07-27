import { useCallback, useEffect, useReducer, useRef } from "react";

import { UnknownVoidhashError, VoidhashError } from "../../errors";

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

function useAsyncFunction<T = unknown>(
  asyncFn: () => Promise<T>,
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

    try {
      const data = await asyncFn();

      if (cancelRequest.current) {
        return;
      }

      dispatch({ payload: data, type: "executed" });
    } catch (error) {
      if (cancelRequest.current) {
        return;
      }

      if (error instanceof VoidhashError) {
        dispatch({ payload: error, type: "error" });
      }

      dispatch({
        payload: new UnknownVoidhashError(
          error instanceof Error ? error : new Error(error as string),
        ),
        type: "error",
      });
    }
  }, [asyncFn]);

  const refetch = useCallback(async () => {
    await executeAsyncFunction();
  }, [executeAsyncFunction]);

  useEffect(() => {
    if (!options?.enabled) {
      return;
    }

    executeAsyncFunction();

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
