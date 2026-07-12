import type { Path, Value } from "../core/types.ts";
import {
  type AnyPrimitive,
  type CommandSession,
  type InferInput,
  type InferProxy,
  type InferSnapshot,
  type PrimitiveWithOptionalEncoding,
} from "./shared.ts";

export class LazyPrimitive<
  TThunk extends () => AnyPrimitive,
> implements PrimitiveWithOptionalEncoding<
  InferInput<ReturnType<TThunk>>,
  InferSnapshot<ReturnType<TThunk>>,
  InferProxy<ReturnType<TThunk>>
> {
  readonly _tag = "LazyPrimitive";
  readonly _Input!: InferInput<ReturnType<TThunk>>;
  readonly _Snapshot!: InferSnapshot<ReturnType<TThunk>>;
  readonly _Proxy!: InferProxy<ReturnType<TThunk>>;

  private readonly thunk: TThunk;
  private resolved?: ReturnType<TThunk>;

  constructor(thunk: TThunk) {
    this.thunk = thunk;
  }

  get schema() {
    return this.resolve().schema;
  }

  encode(input: InferInput<ReturnType<TThunk>>): Value {
    return this.resolve().encode(input);
  }

  encodeOptional(input: unknown): Value | undefined {
    return this.resolve().encodeOptional(input);
  }

  decode(value: Value | undefined): InferSnapshot<ReturnType<TThunk>> | undefined {
    return this.resolve().decode(value);
  }

  createProxy(session: CommandSession, path: Path): InferProxy<ReturnType<TThunk>> {
    return this.resolve().createProxy(session, path);
  }

  private resolve(): ReturnType<TThunk> {
    if (this.resolved === undefined) {
      this.resolved = this.thunk() as ReturnType<TThunk>;
    }
    return this.resolved as ReturnType<TThunk>;
  }
}

export const Lazy = <TThunk extends () => AnyPrimitive>(thunk: TThunk): LazyPrimitive<TThunk> =>
  new LazyPrimitive(thunk);
