import { numberValue, type Path, type Value } from "../core/types.ts";
import type { NumberSchema, NumberValidator } from "../schema/types.ts";
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
> = NeedsValue<number, TRequired, THasDefault>;

export interface NumberProxy<
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> {
  get(): MaybeUndefined<number, TRequired, THasDefault>;
  set(value: InferSetInput<TRequired, THasDefault>): void;
  update(value: InferSetInput<TRequired, THasDefault>): void;
}

interface NumberPrimitiveSchema {
  readonly required: boolean;
  readonly defaultValue: number | undefined;
  readonly validators: readonly NumberValidator[];
}

export class NumberPrimitive<
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> implements PrimitiveWithOptionalEncoding<
  InferSetInput<TRequired, THasDefault>,
  MaybeUndefined<number, TRequired, THasDefault>,
  NumberProxy<TRequired, THasDefault>
> {
  readonly _tag = "NumberPrimitive";
  readonly _Input!: InferSetInput<TRequired, THasDefault>;
  readonly _Snapshot!: MaybeUndefined<number, TRequired, THasDefault>;
  readonly _Proxy!: NumberProxy<TRequired, THasDefault>;

  private readonly state: NumberPrimitiveSchema;

  constructor(state: NumberPrimitiveSchema) {
    this.state = state;
  }

  get schema(): NumberSchema {
    return {
      kind: "number" as const,
      ...(this.state.required ? { required: true } : {}),
      ...(this.state.defaultValue !== undefined
        ? { default: numberValue(this.state.defaultValue) }
        : {}),
      ...(this.state.validators.length > 0 ? { validators: this.state.validators } : {}),
    };
  }

  required(): NumberPrimitive<true, THasDefault> {
    return new NumberPrimitive({
      ...this.state,
      required: true,
    });
  }

  default(defaultValue: number): NumberPrimitive<TRequired, true> {
    return new NumberPrimitive({
      ...this.state,
      defaultValue,
    });
  }

  optional(stripDefaults: boolean): NumberPrimitive<false, false> {
    return new NumberPrimitive({
      ...this.state,
      required: false,
      defaultValue: stripDefaults ? undefined : this.state.defaultValue,
    });
  }

  min(value: number): NumberPrimitive<TRequired, THasDefault> {
    return new NumberPrimitive({
      ...this.state,
      validators: [...this.state.validators, { kind: "min", value }],
    });
  }

  max(value: number): NumberPrimitive<TRequired, THasDefault> {
    return new NumberPrimitive({
      ...this.state,
      validators: [...this.state.validators, { kind: "max", value }],
    });
  }

  positive(): NumberPrimitive<TRequired, THasDefault> {
    return new NumberPrimitive({
      ...this.state,
      validators: [...this.state.validators, { kind: "positive" }],
    });
  }

  negative(): NumberPrimitive<TRequired, THasDefault> {
    return new NumberPrimitive({
      ...this.state,
      validators: [...this.state.validators, { kind: "negative" }],
    });
  }

  int(): NumberPrimitive<TRequired, THasDefault> {
    return new NumberPrimitive({
      ...this.state,
      validators: [...this.state.validators, { kind: "int" }],
    });
  }

  encode(input: InferSetInput<TRequired, THasDefault>): Value {
    const encoded = this.encodeOptional(input);
    if (encoded === undefined) {
      throw new PrimitiveError("Number value is undefined");
    }
    return encoded;
  }

  encodeOptional(input: unknown): Value | undefined {
    if (input === undefined) {
      if (this.state.defaultValue !== undefined) {
        return numberValue(this.state.defaultValue);
      }
      if (this.state.required) {
        throw new PrimitiveError("Number value is required");
      }
      return undefined;
    }
    if (
      typeof input !== "number" ||
      globalThis.Number.isNaN(input) ||
      !globalThis.Number.isFinite(input)
    ) {
      throw new PrimitiveError("Expected finite number input");
    }
    return numberValue(input);
  }

  decode(value: Value | undefined): MaybeUndefined<number, TRequired, THasDefault> {
    return (value?.kind === "number" ? value.value : undefined) as MaybeUndefined<
      number,
      TRequired,
      THasDefault
    >;
  }

  createProxy(session: CommandSession, path: Path): NumberProxy<TRequired, THasDefault> {
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

export const Number = (): NumberPrimitive<false, false> =>
  new NumberPrimitive({
    required: false,
    defaultValue: undefined,
    validators: [],
  });
