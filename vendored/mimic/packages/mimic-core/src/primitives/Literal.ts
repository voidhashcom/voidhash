import { type Path, type Value } from "../core/types.ts";
import type { LiteralSchema } from "../schema/types.ts";
import { encodeScalar } from "./value.ts";
import { getValueAtPath } from "./path.ts";
import {
  PrimitiveError,
  type CommandSession,
  type MaybeUndefined,
  type NeedsValue,
  type PrimitiveWithOptionalEncoding,
} from "./shared.ts";

export type LiteralValue = string | number | boolean;

type InferSetInput<
  T extends LiteralValue,
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> = NeedsValue<T, TRequired, THasDefault>;

export interface LiteralProxy<
  T extends LiteralValue,
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> {
  get(): MaybeUndefined<T, TRequired, THasDefault>;
  set(value: InferSetInput<T, TRequired, THasDefault>): void;
  update(value: InferSetInput<T, TRequired, THasDefault>): void;
}

interface LiteralPrimitiveSchema<T extends LiteralValue> {
  readonly required: boolean;
  readonly defaultValue: T | undefined;
  readonly literal: T;
}

export class LiteralPrimitive<
  T extends LiteralValue,
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> implements PrimitiveWithOptionalEncoding<
  InferSetInput<T, TRequired, THasDefault>,
  MaybeUndefined<T, TRequired, THasDefault>,
  LiteralProxy<T, TRequired, THasDefault>
> {
  readonly _tag = "LiteralPrimitive";
  readonly _Input!: InferSetInput<T, TRequired, THasDefault>;
  readonly _Snapshot!: MaybeUndefined<T, TRequired, THasDefault>;
  readonly _Proxy!: LiteralProxy<T, TRequired, THasDefault>;

  private readonly state: LiteralPrimitiveSchema<T>;

  constructor(state: LiteralPrimitiveSchema<T>) {
    this.state = state;
  }

  get literal(): T {
    return this.state.literal;
  }

  get schema(): LiteralSchema {
    return {
      kind: "literal" as const,
      value: this.state.literal,
      ...(this.state.required ? { required: true } : {}),
      ...(this.state.defaultValue !== undefined
        ? { default: encodeScalar(this.state.defaultValue) as LiteralSchema["default"] }
        : {}),
    };
  }

  required(): LiteralPrimitive<T, true, THasDefault> {
    return new LiteralPrimitive({
      ...this.state,
      required: true,
    });
  }

  default(defaultValue: T): LiteralPrimitive<T, TRequired, true> {
    if (defaultValue !== this.state.literal) {
      throw new PrimitiveError("Literal default must equal the literal value");
    }
    return new LiteralPrimitive({
      ...this.state,
      defaultValue,
    });
  }

  optional(stripDefaults: boolean): LiteralPrimitive<T, false, false> {
    return new LiteralPrimitive({
      ...this.state,
      required: false,
      defaultValue: stripDefaults ? undefined : this.state.defaultValue,
    });
  }

  encode(input: InferSetInput<T, TRequired, THasDefault>): Value {
    const encoded = this.encodeOptional(input);
    if (encoded === undefined) {
      throw new PrimitiveError("Literal value is undefined");
    }
    return encoded;
  }

  encodeOptional(input: unknown): Value | undefined {
    const effectiveInput = input === undefined ? this.state.defaultValue : input;
    if (effectiveInput === undefined) {
      if (this.state.required) {
        throw new PrimitiveError("Literal value is required");
      }
      return undefined;
    }
    if (effectiveInput !== this.state.literal) {
      throw new PrimitiveError("Input does not match the literal value");
    }
    return encodeScalar(this.state.literal);
  }

  decode(value: Value | undefined): MaybeUndefined<T, TRequired, THasDefault> {
    if (value === undefined) {
      return undefined as MaybeUndefined<T, TRequired, THasDefault>;
    }
    if ("value" in value && value.value === this.state.literal) {
      return this.state.literal as MaybeUndefined<T, TRequired, THasDefault>;
    }
    return undefined as MaybeUndefined<T, TRequired, THasDefault>;
  }

  createProxy(session: CommandSession, path: Path): LiteralProxy<T, TRequired, THasDefault> {
    return {
      get: () => this.decode(getValueAtPath(session.current(), path)),
      set: (value) => {
        session.emit([{ kind: "value.set", path, value: this.encode(value) }]);
      },
      update: (value) => {
        session.emit([{ kind: "value.set", path, value: this.encode(value) }]);
      },
    };
  }
}

export const Literal = <T extends LiteralValue>(literal: T): LiteralPrimitive<T, false, false> =>
  new LiteralPrimitive({
    required: false,
    defaultValue: undefined,
    literal,
  });
