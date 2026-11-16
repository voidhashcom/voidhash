import type { Result } from "better-result";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as EffectRuntime from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";
import * as React from "react";

import type { VoidhashError } from "../../errors";
import { UnknownVoidhashError } from "../../errors";
import type { VoidhashInitStatus } from "../internal/client-lifecycle";

type AsyncFunction<T> = () => Promise<Result<T, VoidhashError>>;

interface State<T> {
  data?: T;
  // oxlint-disable-next-line effect/prefer-option-over-null -- surfaced as-is by the public hooks, whose callers are non-Effect app code.
  error: VoidhashError | null;
  isLoading: boolean;
  /** The function the latest settled call ran; its answer is the one in `data`/`error`. */
  settledFunction?: AsyncFunction<T>;
}

type Action<T> =
  | { type: "loading" }
  | { type: "executed"; fn: AsyncFunction<T>; payload: T }
  | { type: "error"; fn: AsyncFunction<T>; payload: VoidhashError };

type UseAsyncFunctionReturn<T> = Omit<State<T>, "settledFunction"> & {
  refetch: () => Promise<void>;
};

/**
 * Drives a `Promise<Result<T, VoidhashError>>` client call as hook state.
 * The `Err` channel becomes `error`; unexpected exceptions are normalized
 * into an `Err`-shaped state as well.
 *
 * `status` is the provider's lifecycle status (`None` outside a provider): the
 * function runs once the provider is `ready`, and again whenever it changes. `isLoading` is `true`
 * while the provider initializes and until the current function has answered,
 * so a hook never reports a settled empty answer it has not read yet; it is
 * `false` for a disabled or failed provider, where nothing is going to run.
 * A refetch keeps the previous `data` until the new answer arrives.
 */
function useAsyncFunction<T = unknown>(
  asyncFn: AsyncFunction<T>,
  status: Option.Option<VoidhashInitStatus>,
): UseAsyncFunctionReturn<T> {
  // Each call takes the next id; only the latest call may write its answer,
  // so a slow answer to a superseded or cancelled call never lands.
  const latestCall = React.useRef(0);

  const asyncFnReducer = (state: State<T>, action: Action<T>): State<T> => {
    if (action.type === "loading") return { data: state.data, error: null, isLoading: true };
    if (action.type === "executed") {
      return { data: action.payload, error: null, isLoading: false, settledFunction: action.fn };
    }
    return {
      data: state.data,
      error: action.payload,
      isLoading: false,
      settledFunction: action.fn,
    };
  };

  const [state, dispatch] = React.useReducer(asyncFnReducer, { error: null, isLoading: false });

  const executeAsyncFunction = React.useCallback(async () => {
    latestCall.current += 1;
    const call = latestCall.current;
    dispatch({ type: "loading" });

    const exit = await EffectRuntime.runPromise(
      Effect.exit(Effect.tryPromise({ try: () => asyncFn(), catch: (error) => error })),
    );

    if (latestCall.current !== call) {
      return;
    }

    if (Exit.isSuccess(exit)) {
      const result = exit.value;
      if (result.isOk()) {
        dispatch({ fn: asyncFn, payload: result.value, type: "executed" });
      } else {
        dispatch({ fn: asyncFn, payload: result.error, type: "error" });
      }
      return;
    }

    dispatch({
      fn: asyncFn,
      payload: new UnknownVoidhashError(Cause.squash(exit.cause)),
      type: "error",
    });
  }, [asyncFn]);

  const refetch = React.useCallback(async () => {
    await executeAsyncFunction();
  }, [executeAsyncFunction]);

  const enabled = Option.contains(status, "ready");
  React.useEffect(() => {
    if (!enabled) {
      return;
    }

    void executeAsyncFunction();

    // A call still running when the inputs change or the component unmounts
    // must not write its answer afterwards.
    return () => {
      latestCall.current += 1;
    };
  }, [executeAsyncFunction, enabled]);

  return {
    data: state.data,
    error: state.error,
    isLoading:
      Option.contains(status, "initializing") ||
      (enabled && (state.isLoading || state.settledFunction !== asyncFn)),
    refetch,
  };
}

export default useAsyncFunction;
