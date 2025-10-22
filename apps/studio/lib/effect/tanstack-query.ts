import {
  type MutationFunction,
  mutationOptions,
  QueryClient,
  type QueryFunction,
  type QueryFunctionContext,
  queryOptions,
  type skipToken,
  type UseMutationOptions,
  type UseQueryOptions
} from '@tanstack/react-query';
import {
  Cause,
  Duration,
  Effect,
  Exit,
  type Layer,
  ManagedRuntime
} from 'effect';
// import { useRuntime } from '@/lib/effect/runtime/use-runtime';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Duration.toMillis('1 minute'),
      retry: false,
      refetchOnWindowFocus: false
    }
  }
});

// /**
//  * @internal
//  */
// const useRunner = () => {
//   const runtime = useRuntime();
//   return React.useCallback(
//    ,
//     [runtime.runPromiseExit]
//   );
// };

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function createEffectQuery<TLayer extends Layer.Layer<any, any, never>>(
  layer: TLayer
) {
  type TManagedRuntime = ManagedRuntime.ManagedRuntime<
    Layer.Layer.Success<TLayer>,
    never
  >;
  type RuntimeContext = ManagedRuntime.ManagedRuntime.Context<TManagedRuntime>;

  type EffectfulMutationFunction<
    TData,
    E,
    TVariables,
    R extends RuntimeContext
  > = (variables: TVariables) => Effect.Effect<TData, E, R>;

  type EffectfulMutationOptions<
    TData,
    E,
    TVariables,
    R extends RuntimeContext
  > = Omit<
    UseMutationOptions<TData, Error, TVariables>,
    'mutationKey' | 'mutationFn'
  > & {
    mutationKey: string;
    mutationFn:
      | EffectfulMutationFunction<TData, E, TVariables, R>
      | typeof skipToken;
  };

  type EffectfulQueryFunction<
    TData,
    E,
    R extends RuntimeContext,
    TQueryKey extends QueryKey = QueryKey,
    TPageParam = never
  > = (
    context: QueryFunctionContext<TQueryKey, TPageParam>
  ) => Effect.Effect<TData, E, R>;

  type EffectfulQueryOptions<
    TData,
    TError,
    R extends RuntimeContext,
    TQueryKey extends QueryKey = QueryKey,
    TPageParam = never
  > = Omit<
    UseQueryOptions<TData, TError, TData, TQueryKey>,
    'queryKey' | 'queryFn'
  > & {
    queryKey: TQueryKey;
    queryFn:
      | EffectfulQueryFunction<TData, TError, R, TQueryKey, TPageParam>
      | typeof skipToken;
  };

  const runtime = ManagedRuntime.make(layer);
  const runner =
    <A, E, R extends RuntimeContext>(span: string) =>
    (effect: Effect.Effect<A, E, R>): Promise<Exit.Exit<A, E>> =>
      effect.pipe(
        Effect.withSpan(span),
        Effect.scoped,
        Effect.tapErrorCause(Effect.logError),
        runtime.runPromiseExit
      );

  return {
    queryOptions: <
      TData,
      E,
      R extends RuntimeContext = RuntimeContext,
      TQueryKey extends QueryKey = QueryKey
    >(
      options: EffectfulQueryOptions<TData, E, R, TQueryKey>
    ): UseQueryOptions<
      TData,
      EffectfulError<Cause.Cause<E>>,
      TData,
      TQueryKey
    > => {
      const [spanName] = options.queryKey;

      const queryFn: QueryFunction<TData, TQueryKey> = async (
        context: QueryFunctionContext<TQueryKey>
      ) => {
        const effect = (
          options.queryFn as EffectfulQueryFunction<TData, E, R, TQueryKey>
        )(context);
        const result = await effect.pipe(runner(spanName));
        return Exit.match(result, {
          onSuccess: (value) => value,
          onFailure: (cause) => {
            throw new EffectfulError(Cause.pretty(cause), cause);
          }
        });
      };

      return queryOptions({
        ...options,
        queryFn
      }) as UseQueryOptions<
        TData,
        EffectfulError<Cause.Cause<E>>,
        TData,
        TQueryKey
      >;
    },
    mutationOptions: <TData, E, TVariables, R extends RuntimeContext>(
      options: EffectfulMutationOptions<TData, E, TVariables, R>
    ) => {
      const spanName = options.mutationKey;
      const mutationFn: MutationFunction<TData, TVariables> = async (
        variables: TVariables
      ) => {
        const effect = (
          options.mutationFn as EffectfulMutationFunction<
            TData,
            E,
            TVariables,
            R
          >
        )(variables);
        const result = await effect.pipe(runner(spanName));
        return Exit.match(result, {
          onSuccess: (value) => value,
          onFailure: (cause) => {
            throw new EffectfulError(Cause.pretty(cause), cause);
          }
        });
      };

      return mutationOptions({
        ...options,
        mutationFn
      }) as UseMutationOptions<
        TData,
        EffectfulError<Cause.Cause<E>>,
        TVariables
      >;
    }
  };
}

type QueryKey = readonly [string, string, Record<string, unknown>?];
// biome-ignore lint/suspicious/noExplicitAny: generic
class EffectfulError<TCause extends Cause.Cause<any>> extends Error {
  readonly cause: TCause;
  constructor(message: string, cause: TCause) {
    super(message);
    this.cause = cause;
  }
}
