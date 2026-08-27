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
  TPrimitive extends AnyPrimitive,
> implements PrimitiveWithOptionalEncoding<
  InferInput<TPrimitive>,
  InferSnapshot<TPrimitive>,
  InferProxy<TPrimitive>
> {
  readonly _tag = "LazyPrimitive";
  readonly _Input!: InferInput<TPrimitive>;
  readonly _Snapshot!: InferSnapshot<TPrimitive>;
  readonly _Proxy!: InferProxy<TPrimitive>;

  private readonly thunk: () => TPrimitive;
  private resolved?: TPrimitive;

  constructor(thunk: () => TPrimitive) {
    this.thunk = thunk;
  }

  get schema() {
    return this.resolve().schema;
  }

  encode(input: InferInput<TPrimitive>): Value {
    return this.resolve().encode(input);
  }

  encodeOptional(input: unknown): Value | undefined {
    return this.resolve().encodeOptional(input);
  }

  decode(value: Value | undefined): InferSnapshot<TPrimitive> | undefined {
    return this.resolve().decode(value);
  }

  createProxy(session: CommandSession, path: Path): InferProxy<TPrimitive> {
    return this.resolve().createProxy(session, path);
  }

  private resolve(): TPrimitive {
    if (this.resolved === undefined) {
      this.resolved = this.thunk();
    }
    return this.resolved;
  }
}

export const Lazy = <TPrimitive extends AnyPrimitive>(
  thunk: () => TPrimitive,
): LazyPrimitive<TPrimitive> => new LazyPrimitive(thunk);
