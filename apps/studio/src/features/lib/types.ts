export type QueryData<T extends (...args: unknown[]) => Promise<unknown>> =
  Awaited<ReturnType<T>>;
