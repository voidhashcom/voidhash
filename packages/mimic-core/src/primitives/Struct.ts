import { objectValue, type ObjectValue, type Path, type Value } from "../core/types.ts";
import type { ObjectSchema } from "../schema/types.ts";
import { getObjectAtPath, getValueAtPath } from "./path.ts";
import {
  PrimitiveError,
  type AnyPrimitive,
  type CommandSession,
  type InferInput,
  type InferProxy,
  type InferSnapshot,
  type MaybeUndefined,
  type PrimitiveWithOptionalEncoding,
} from "./shared.ts";

type RequiredKey<TFields extends Record<string, AnyPrimitive>> = {
  [K in keyof TFields]: TFields[K] extends { readonly _Input: infer TInput }
    ? undefined extends TInput
      ? never
      : K
    : never;
}[keyof TFields];

type OptionalKey<TFields extends Record<string, AnyPrimitive>> = Exclude<
  keyof TFields,
  RequiredKey<TFields>
>;

export type StructSetInput<TFields extends Record<string, AnyPrimitive>> = {
  readonly [K in RequiredKey<TFields>]: InferInput<TFields[K]>;
} & {
  readonly [K in OptionalKey<TFields>]?: InferInput<TFields[K]>;
};

/**
 * Keys of a struct that may be deleted via `update({ field: undefined })`:
 * fields that are optional or carry a default (deleting a defaulted field
 * re-materializes the default on the next validate). Deleting a required
 * field without a default would make the document fail validation, so those
 * keys never accept `undefined`.
 */
type DeletableKey<TFields extends Record<string, AnyPrimitive>> = {
  [K in keyof TFields]: undefined extends InferInput<TFields[K]> ? K : never;
}[keyof TFields];

export type StructUpdateInput<TFields extends Record<string, AnyPrimitive>> = {
  readonly [K in keyof TFields]?:
    | (TFields[K] extends StructPrimitive<infer TNested, any, any>
        ? StructUpdateInput<TNested>
        : InferInput<TFields[K]>)
    | (K extends DeletableKey<TFields> ? undefined : never);
};

/**
 * Call-site validation for `update(...)`. Optional properties accept an
 * explicit `undefined` even when their declared type excludes it (unless
 * `exactOptionalPropertyTypes` is enabled), so {@link StructUpdateInput}
 * alone cannot reject `update({ requiredNoDefault: undefined })`. This type
 * maps any field explicitly set to `undefined` that is not deletable
 * (required without a default) to `never`, failing the call regardless of
 * compiler options. Recurses into nested struct updates.
 */
export type ValidatedStructUpdate<TFields extends Record<string, AnyPrimitive>, T> = {
  [K in keyof T]: K extends keyof TFields ? ValidatedStructFieldUpdate<TFields[K], T[K]> : never;
};

type ValidatedStructFieldUpdate<TField extends AnyPrimitive, TValue> = [TField] extends [
  StructPrimitive<infer TNested, any, any>,
]
  ? ValidatedStructUpdate<TNested, Exclude<TValue, undefined>> | DeletionOf<TField, TValue>
  : undefined extends InferInput<TField>
    ? TValue
    : Exclude<TValue, undefined>;

type DeletionOf<TField extends AnyPrimitive, TValue> =
  undefined extends InferInput<TField> ? Extract<TValue, undefined> : never;

type SnapshotOptionalKey<TFields extends Record<string, AnyPrimitive>> = {
  [K in keyof TFields]: undefined extends InferSnapshot<TFields[K]> ? K : never;
}[keyof TFields];

/**
 * Decoded shape of a struct. Fields whose primitive is `.required()` or
 * carries a `.default()` snapshot as non-optional `T` (the runtime
 * materializes defaults on every validate, so they are always present);
 * only optional-without-default fields stay `?`/`| undefined`.
 */
export type StructSnapshot<TFields extends Record<string, AnyPrimitive>> = {
  readonly [K in Exclude<keyof TFields, SnapshotOptionalKey<TFields>>]: InferSnapshot<TFields[K]>;
} & {
  readonly [K in SnapshotOptionalKey<TFields>]?: InferSnapshot<TFields[K]>;
};

/**
 * Partial-update input of a struct primitive (the shape accepted by
 * `proxy.update(...)`): every field optional, `undefined` deletes the field.
 */
export type InferUpdateInput<T extends AnyPrimitive> =
  T extends StructPrimitive<infer TFields, any, any> ? StructUpdateInput<TFields> : never;

export type StructProxy<
  TFields extends Record<string, AnyPrimitive>,
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> = {
  readonly [K in keyof TFields]: InferProxy<TFields[K]>;
} & {
  get(): MaybeUndefined<StructSnapshot<TFields>, TRequired, THasDefault>;
  set(value: StructSetInput<TFields>): void;
  update<T extends StructUpdateInput<TFields>>(value: T & ValidatedStructUpdate<TFields, T>): void;
};

interface StructPrimitiveSchema<TFields extends Record<string, AnyPrimitive>> {
  readonly required: boolean;
  readonly defaultValue: StructSetInput<TFields> | undefined;
  readonly fields: TFields;
}

export class StructPrimitive<
  TFields extends Record<string, AnyPrimitive>,
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> implements PrimitiveWithOptionalEncoding<
  TRequired extends true ? StructSetInput<TFields> : StructSetInput<TFields> | undefined,
  MaybeUndefined<StructSnapshot<TFields>, TRequired, THasDefault>,
  StructProxy<TFields, TRequired, THasDefault>
> {
  readonly _tag = "StructPrimitive";
  readonly _Input!: TRequired extends true
    ? StructSetInput<TFields>
    : StructSetInput<TFields> | undefined;
  readonly _Snapshot!: MaybeUndefined<StructSnapshot<TFields>, TRequired, THasDefault>;
  readonly _Proxy!: StructProxy<TFields, TRequired, THasDefault>;

  private readonly state: StructPrimitiveSchema<TFields>;

  constructor(state: StructPrimitiveSchema<TFields>) {
    this.state = state;
  }

  get fields(): TFields {
    return this.state.fields;
  }

  get schema(): ObjectSchema {
    const fields: Record<string, AnyPrimitive["schema"]> = {};
    for (const [key, primitive] of Object.entries(this.state.fields)) {
      fields[key] = primitive.schema;
    }
    return {
      kind: "object" as const,
      fields,
      ...(this.state.required ? { required: true } : {}),
      ...(this.state.defaultValue !== undefined
        ? {
            default: this.encode(this.state.defaultValue as StructSetInput<TFields>) as ObjectValue,
          }
        : {}),
    };
  }

  required(): StructPrimitive<TFields, true, THasDefault> {
    return new StructPrimitive({
      ...this.state,
      required: true,
    });
  }

  default(defaultValue: StructSetInput<TFields>): StructPrimitive<TFields, TRequired, true> {
    return new StructPrimitive({
      ...this.state,
      defaultValue,
    });
  }

  /**
   * Returns a new struct with the given fields added. The struct-level
   * default is dropped (it no longer matches the widened field set), so the
   * result is typed without a default — re-apply `.default(...)` if needed.
   */
  extend<TNewFields extends Record<string, AnyPrimitive>>(
    newFields: TNewFields,
  ): StructPrimitive<TFields & TNewFields, TRequired, false> {
    return new StructPrimitive({
      required: this.state.required,
      defaultValue: undefined,
      fields: {
        ...this.state.fields,
        ...newFields,
      } as TFields & TNewFields,
    });
  }

  /**
   * Returns a new struct with every field made optional. The struct-level
   * default is dropped at runtime, so the result is typed without a default —
   * re-apply `.default(...)` if needed.
   */
  partial(options?: {
    stripDefaults?: boolean;
  }): StructPrimitive<{ [K in keyof TFields]: AnyPrimitive }, TRequired, false> {
    const stripDefaults = options?.stripDefaults ?? false;
    const fields: Record<string, AnyPrimitive> = {};
    for (const [key, field] of Object.entries(this.state.fields)) {
      fields[key] = makePrimitiveOptional(field, stripDefaults);
    }
    return new StructPrimitive({
      required: this.state.required,
      defaultValue: undefined,
      fields: fields as { [K in keyof TFields]: AnyPrimitive },
    });
  }

  optional(stripDefaults: boolean): StructPrimitive<TFields, false, false> {
    // Recurse when stripping so nested struct/array fields lose their own
    // defaults too. Without this, a fully-stripped partial (e.g. a state
    // override schema) keeps nested field defaults, which re-materialize when
    // the partial's own `.default({})` is validated on a serialize→parse
    // round-trip — breaking schema idempotency.
    const fields = stripDefaults
      ? (Object.fromEntries(
          Object.entries(this.state.fields).map(([key, field]) => [
            key,
            makePrimitiveOptional(field, true),
          ]),
        ) as TFields)
      : this.state.fields;
    return new StructPrimitive({
      required: false,
      defaultValue: stripDefaults ? undefined : this.state.defaultValue,
      fields,
    });
  }

  encode(
    input: TRequired extends true ? StructSetInput<TFields> : StructSetInput<TFields> | undefined,
  ): Value {
    const encoded = this.encodeOptional(input);
    if (encoded === undefined) {
      throw new PrimitiveError("Struct value is undefined");
    }
    return encoded;
  }

  encodeOptional(input: unknown): Value | undefined {
    if (input === undefined) {
      if (this.state.defaultValue !== undefined) {
        return this.encode(this.state.defaultValue as StructSetInput<TFields>);
      }
      if (this.state.required) {
        throw new PrimitiveError("Struct value is required");
      }
      return undefined;
    }
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new PrimitiveError("Expected object input");
    }
    const record = input as Record<string, unknown>;
    const fields: Record<string, Value> = {};
    for (const [key, primitive] of Object.entries(this.state.fields)) {
      const encoded = primitive.encodeOptional(record[key]);
      if (encoded !== undefined) {
        fields[key] = encoded;
      }
    }
    return objectValue(fields);
  }

  decode(
    value: Value | undefined,
  ): MaybeUndefined<StructSnapshot<TFields>, TRequired, THasDefault> {
    if (value?.kind !== "object") {
      return undefined as MaybeUndefined<StructSnapshot<TFields>, TRequired, THasDefault>;
    }
    const result: Record<string, unknown> = {};
    for (const [key, primitive] of Object.entries(this.state.fields)) {
      const decoded = primitive.decode(value.fields[key]);
      if (decoded !== undefined) {
        result[key] = decoded;
      }
    }
    return result as MaybeUndefined<StructSnapshot<TFields>, TRequired, THasDefault>;
  }

  createProxy(session: CommandSession, path: Path): StructProxy<TFields, TRequired, THasDefault> {
    const proxy = {
      get: () => this.decode(getValueAtPath(session.current(), path)),
      set: (value: StructSetInput<TFields>) => {
        session.emit([{ kind: "value.set", path, value: this.encode(value) }]);
      },
      update: (value: StructUpdateInput<TFields>) => {
        emitStructUpdate(this.state.fields, session, path, value);
      },
    } as Record<string, unknown>;

    for (const [key, primitive] of Object.entries(this.state.fields)) {
      proxy[key] = primitive.createProxy(session, [...path, { kind: "field", key }]);
    }

    return proxy as StructProxy<TFields, TRequired, THasDefault>;
  }
}

const emitStructUpdate = (
  fields: Record<string, AnyPrimitive>,
  session: CommandSession,
  path: Path,
  value: Record<string, unknown>,
): void => {
  for (const [key, next] of Object.entries(value)) {
    const primitive = fields[key];
    if (!primitive) {
      continue;
    }
    if (next === undefined) {
      const current = getObjectAtPath(session.current(), path);
      if (current?.fields[key] !== undefined) {
        session.emit([{ kind: "object.delete", path, key }]);
      }
      continue;
    }

    if (
      primitive._tag === "StructPrimitive" &&
      typeof next === "object" &&
      next !== null &&
      !Array.isArray(next)
    ) {
      (primitive as StructPrimitive<Record<string, AnyPrimitive>, any, any>)
        .createProxy(session, [...path, { kind: "field", key }])
        .update(next as Record<string, unknown>);
      continue;
    }

    session.emit([
      {
        kind: "object.set",
        path,
        key,
        value: primitive.encode(next as never),
      },
    ]);
  }
};

const makePrimitiveOptional = (primitive: AnyPrimitive, stripDefaults: boolean): AnyPrimitive => {
  const optional = (primitive as { optional?: (stripDefaults: boolean) => AnyPrimitive }).optional;
  if (typeof optional === "function") {
    return optional.call(primitive, stripDefaults);
  }
  return primitive;
};

export const Struct = <TFields extends Record<string, AnyPrimitive>>(
  fields: TFields,
): StructPrimitive<TFields, false, false> =>
  new StructPrimitive({
    required: false,
    defaultValue: undefined,
    fields,
  });
