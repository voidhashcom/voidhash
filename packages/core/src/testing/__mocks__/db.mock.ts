import { Context, Data, Effect } from "effect";
import { vi } from "vitest";

// Mock the database error class
export class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

// Mock transaction context
type TransactionContextShape = <U>(
  fn: (client: unknown) => Promise<U>
) => Effect.Effect<U, DatabaseError>;

export class TransactionContext extends Context.Tag("TransactionContext")<
  TransactionContext,
  TransactionContextShape
>() {
  static readonly provide = (
    transaction: TransactionContextShape
  ): (<A, E, R>(
    self: Effect.Effect<A, E, R>
  ) => Effect.Effect<A, E, Exclude<R, TransactionContext>>) =>
    Effect.provideService(this, transaction);
}

// Mock database client
export const mockDb = {
  transaction: vi.fn(),
  // Add other database methods as needed for your tests
};

// Mock Db service
export const Db = Effect.Service<{
  use: <T>(
    fn: (client: unknown) => Promise<T>
  ) => Effect.Effect<T, DatabaseError>;
  makeQuery: <A, E, R, Input = never>(
    queryFn: (execute: unknown, input: Input) => Effect.Effect<A, E, R>
  ) => (
    ...args: [Input] extends [never] ? [] : [input: Input]
  ) => Effect.Effect<A, E, R>;
  transaction: <T, E, R>(
    txExecute: (tx: TransactionContextShape) => Effect.Effect<T, E, R>
  ) => Effect.Effect<T, DatabaseError | E, R>;
}>()("app/Db", {
  dependencies: [],
  effect: Effect.succeed({
    makeQuery: vi.fn().mockImplementation(() => () => Effect.succeed({})),
    transaction: vi.fn().mockImplementation(() => Effect.succeed({})),
    use: vi
      .fn()
      .mockImplementation((fn: (client: unknown) => Promise<unknown>) =>
        Effect.tryPromise({
          catch: (cause) =>
            new DatabaseError({
              cause,
              message: "Mock database error",
            }),
          try: () => fn(mockDb),
        })
      ),
  }),
});

// Export mock utilities for testing
export const createMockDb = () => ({
  makeQuery: vi.fn().mockImplementation(() => () => Effect.succeed({})),
  transaction: vi.fn().mockImplementation(() => Effect.succeed({})),
  use: vi.fn().mockImplementation((fn: (client: unknown) => Promise<unknown>) =>
    Effect.tryPromise({
      catch: (cause) =>
        new DatabaseError({
          cause,
          message: "Mock database error",
        }),
      try: () => fn(mockDb),
    })
  ),
});

// Mock transaction
export const mockTransaction = {
  // Add transaction methods as needed
};

// Reset all mocks
export const resetDbMocks = () => {
  vi.clearAllMocks();
};
