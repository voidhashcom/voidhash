import { stringValue, type Path, type Value } from "../core/types.ts";
import type { StringSchema, StringValidator } from "../schema/types.ts";
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
> = NeedsValue<string, TRequired, THasDefault>;

export interface StringProxy<
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> {
  get(): MaybeUndefined<string, TRequired, THasDefault>;
  set(value: InferSetInput<TRequired, THasDefault>): void;
  update(value: InferSetInput<TRequired, THasDefault>): void;
}

interface StringPrimitiveSchema {
  readonly required: boolean;
  readonly defaultValue: string | undefined;
  readonly validators: readonly StringValidator[];
}

export class StringPrimitive<
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> implements PrimitiveWithOptionalEncoding<
  InferSetInput<TRequired, THasDefault>,
  MaybeUndefined<string, TRequired, THasDefault>,
  StringProxy<TRequired, THasDefault>
> {
  readonly _tag = "StringPrimitive";
  readonly _Input!: InferSetInput<TRequired, THasDefault>;
  readonly _Snapshot!: MaybeUndefined<string, TRequired, THasDefault>;
  readonly _Proxy!: StringProxy<TRequired, THasDefault>;

  private readonly state: StringPrimitiveSchema;

  constructor(state: StringPrimitiveSchema) {
    this.state = state;
  }

  get schema(): StringSchema {
    return {
      kind: "string" as const,
      ...(this.state.required ? { required: true } : {}),
      ...(this.state.defaultValue !== undefined
        ? { default: stringValue(this.state.defaultValue) }
        : {}),
      ...(this.state.validators.length > 0 ? { validators: this.state.validators } : {}),
    };
  }

  required(): StringPrimitive<true, THasDefault> {
    return new StringPrimitive({
      ...this.state,
      required: true,
    });
  }

  default(defaultValue: string): StringPrimitive<TRequired, true> {
    return new StringPrimitive({
      ...this.state,
      defaultValue,
    });
  }

  optional(stripDefaults: boolean): StringPrimitive<false, false> {
    return new StringPrimitive({
      ...this.state,
      required: false,
      defaultValue: stripDefaults ? undefined : this.state.defaultValue,
    });
  }

  min(length: number): StringPrimitive<TRequired, THasDefault> {
    return new StringPrimitive({
      ...this.state,
      validators: [...this.state.validators, { kind: "minLength", value: length }],
    });
  }

  max(length: number): StringPrimitive<TRequired, THasDefault> {
    return new StringPrimitive({
      ...this.state,
      validators: [...this.state.validators, { kind: "maxLength", value: length }],
    });
  }

  length(exact: number): StringPrimitive<TRequired, THasDefault> {
    return new StringPrimitive({
      ...this.state,
      validators: [...this.state.validators, { kind: "length", value: exact }],
    });
  }

  regex(pattern: RegExp, _message?: string): StringPrimitive<TRequired, THasDefault> {
    return new StringPrimitive({
      ...this.state,
      validators: [
        ...this.state.validators,
        { kind: "regex", pattern: pattern.source, flags: pattern.flags },
      ],
    });
  }

  email(): StringPrimitive<TRequired, THasDefault> {
    return new StringPrimitive({
      ...this.state,
      validators: [...this.state.validators, { kind: "email" }],
    });
  }

  url(): StringPrimitive<TRequired, THasDefault> {
    return new StringPrimitive({
      ...this.state,
      validators: [...this.state.validators, { kind: "url" }],
    });
  }

  encode(input: InferSetInput<TRequired, THasDefault>): Value {
    const encoded = this.encodeOptional(input);
    if (encoded === undefined) {
      throw new PrimitiveError("String value is undefined");
    }
    return encoded;
  }

  encodeOptional(input: unknown): Value | undefined {
    if (input === undefined) {
      if (this.state.defaultValue !== undefined) {
        return stringValue(this.state.defaultValue);
      }
      if (this.state.required) {
        throw new PrimitiveError("String value is required");
      }
      return undefined;
    }
    if (typeof input !== "string") {
      throw new PrimitiveError("Expected string input");
    }
    return stringValue(input);
  }

  decode(value: Value | undefined): MaybeUndefined<string, TRequired, THasDefault> {
    return (value?.kind === "string" ? value.value : undefined) as MaybeUndefined<
      string,
      TRequired,
      THasDefault
    >;
  }

  createProxy(session: CommandSession, path: Path): StringProxy<TRequired, THasDefault> {
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

export const String = (): StringPrimitive<false, false> =>
  new StringPrimitive({
    required: false,
    defaultValue: undefined,
    validators: [],
  });
