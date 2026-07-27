import { booleanValue, type Path, type Value } from "../core/types.ts";
import type { BooleanSchema } from "../schema/types.ts";
import { getValueAtPath } from "./path.ts";
import {
  PrimitiveError,
  type CommandSession,
  type MaybeUndefined,
  type NeedsValue,
  type PrimitiveWithOptionalEncoding,
} from "./shared.ts";

type InferSetInput<
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> = NeedsValue<boolean, TRequired, THasDefault>;

export interface BooleanProxy<
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> {
  get(): MaybeUndefined<boolean, TRequired, THasDefault>;
  set(value: InferSetInput<TRequired, THasDefault>): void;
  update(value: InferSetInput<TRequired, THasDefault>): void;
}

interface BooleanPrimitiveSchema {
  readonly required: boolean;
  readonly defaultValue: boolean | undefined;
}

export class BooleanPrimitive<
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> implements PrimitiveWithOptionalEncoding<
  InferSetInput<TRequired, THasDefault>,
  MaybeUndefined<boolean, TRequired, THasDefault>,
  BooleanProxy<TRequired, THasDefault>
> {
  readonly _tag = "BooleanPrimitive";
  readonly _Input!: InferSetInput<TRequired, THasDefault>;
  readonly _Snapshot!: MaybeUndefined<boolean, TRequired, THasDefault>;
  readonly _Proxy!: BooleanProxy<TRequired, THasDefault>;

  private readonly state: BooleanPrimitiveSchema;

  constructor(state: BooleanPrimitiveSchema) {
    this.state = state;
  }

  get schema(): BooleanSchema {
    return {
      kind: "boolean" as const,
      ...(this.state.required ? { required: true } : {}),
      ...(this.state.defaultValue !== undefined
        ? { default: booleanValue(this.state.defaultValue) }
        : {}),
    };
  }

  required(): BooleanPrimitive<true, THasDefault> {
    return new BooleanPrimitive({
      ...this.state,
      required: true,
    });
  }

  default(defaultValue: boolean): BooleanPrimitive<TRequired, true> {
    return new BooleanPrimitive({
      ...this.state,
      defaultValue,
    });
  }

  optional(stripDefaults: boolean): BooleanPrimitive<false, false> {
    return new BooleanPrimitive({
      ...this.state,
      required: false,
      defaultValue: stripDefaults ? undefined : this.state.defaultValue,
    });
  }

  encode(input: InferSetInput<TRequired, THasDefault>): Value {
    const encoded = this.encodeOptional(input);
    if (encoded === undefined) {
      throw new PrimitiveError("Boolean value is undefined");
    }
    return encoded;
  }

  encodeOptional(input: unknown): Value | undefined {
    if (input === undefined) {
      if (this.state.defaultValue !== undefined) {
        return booleanValue(this.state.defaultValue);
      }
      if (this.state.required) {
        throw new PrimitiveError("Boolean value is required");
      }
      return undefined;
    }
    if (typeof input !== "boolean") {
      throw new PrimitiveError("Expected boolean input");
    }
    return booleanValue(input);
  }

  decode(value: Value | undefined): MaybeUndefined<boolean, TRequired, THasDefault> {
    return (value?.kind === "boolean" ? value.value : undefined) as MaybeUndefined<
      boolean,
      TRequired,
      THasDefault
    >;
  }

  createProxy(session: CommandSession, path: Path): BooleanProxy<TRequired, THasDefault> {
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

export const Boolean = (): BooleanPrimitive<false, false> =>
  new BooleanPrimitive({
    required: false,
    defaultValue: undefined,
  });
