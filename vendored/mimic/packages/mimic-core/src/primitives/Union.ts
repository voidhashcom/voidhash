import {
  objectValue,
  stringValue,
  type ObjectValue,
  type Path,
  type Value,
} from "../core/types.ts";
import type { ObjectSchema, UnionSchema } from "../schema/types.ts";
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
import type { StructPrimitive } from "./Struct.ts";

export type UnionVariants = Record<string, StructPrimitive<Record<string, AnyPrimitive>, any, any>>;

export type InferUnionInput<TVariants extends UnionVariants> = {
  [K in keyof TVariants]: InferInput<TVariants[K]> & Record<string, unknown>;
}[keyof TVariants];

export type InferUnionSnapshot<TVariants extends UnionVariants> = {
  [K in keyof TVariants]: InferSnapshot<TVariants[K]> & Record<string, unknown>;
}[keyof TVariants];

export interface UnionProxy<TVariants extends UnionVariants, _TDiscriminator extends string> {
  get(): InferUnionSnapshot<TVariants> | undefined;
  set(value: InferUnionInput<TVariants>): void;
  as<K extends keyof TVariants>(variant: K): InferProxy<TVariants[K]>;
  match<R>(handlers: { [K in keyof TVariants]: (proxy: InferProxy<TVariants[K]>) => R }):
    | R
    | undefined;
}

interface UnionPrimitiveSchema<TVariants extends UnionVariants, TDiscriminator extends string> {
  readonly required: boolean;
  readonly defaultValue: InferUnionInput<TVariants> | undefined;
  readonly discriminator: TDiscriminator;
  readonly variants: TVariants;
}

export class UnionPrimitive<
  TVariants extends UnionVariants,
  TDiscriminator extends string = "type",
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> implements PrimitiveWithOptionalEncoding<
  InferUnionInput<TVariants> | undefined,
  MaybeUndefined<InferUnionSnapshot<TVariants>, TRequired, THasDefault>,
  UnionProxy<TVariants, TDiscriminator>
> {
  readonly _tag = "UnionPrimitive";
  readonly _Input!: InferUnionInput<TVariants> | undefined;
  readonly _Snapshot!: MaybeUndefined<InferUnionSnapshot<TVariants>, TRequired, THasDefault>;
  readonly _Proxy!: UnionProxy<TVariants, TDiscriminator>;

  private readonly state: UnionPrimitiveSchema<TVariants, TDiscriminator>;

  constructor(state: UnionPrimitiveSchema<TVariants, TDiscriminator>) {
    this.state = state;
  }

  get discriminator(): TDiscriminator {
    return this.state.discriminator;
  }

  get variants(): TVariants {
    return this.state.variants;
  }

  get schema(): UnionSchema {
    const variants: Record<string, ObjectSchema> = {};
    for (const [key, variant] of Object.entries(this.state.variants)) {
      const schema = variant.schema;
      if (schema.kind !== "object") {
        throw new PrimitiveError("Union variants must compile to object schemas");
      }
      const fields = {
        ...schema.fields,
        [this.state.discriminator]: {
          kind: "literal" as const,
          value: key,
        },
      };
      variants[key] = {
        kind: "object",
        fields,
      } as ObjectSchema;
    }
    return {
      kind: "union" as const,
      discriminator: this.state.discriminator,
      variants,
      ...(this.state.required ? { required: true } : {}),
      ...(this.state.defaultValue !== undefined
        ? { default: this.encode(this.state.defaultValue) as ObjectValue }
        : {}),
    };
  }

  required(): UnionPrimitive<TVariants, TDiscriminator, true, THasDefault> {
    return new UnionPrimitive({
      ...this.state,
      required: true,
    });
  }

  default(
    defaultValue: InferUnionInput<TVariants>,
  ): UnionPrimitive<TVariants, TDiscriminator, TRequired, true> {
    return new UnionPrimitive({
      ...this.state,
      defaultValue,
    });
  }

  encode(input: InferUnionInput<TVariants> | undefined): Value {
    const encoded = this.encodeOptional(input);
    if (encoded === undefined) {
      throw new PrimitiveError("Union value is undefined");
    }
    return encoded;
  }

  encodeOptional(input: unknown): Value | undefined {
    const effectiveInput = input === undefined ? this.state.defaultValue : input;
    if (effectiveInput === undefined) {
      if (this.state.required) {
        throw new PrimitiveError("Union value is required");
      }
      return undefined;
    }
    if (
      typeof effectiveInput !== "object" ||
      effectiveInput === null ||
      Array.isArray(effectiveInput)
    ) {
      throw new PrimitiveError("Expected union input object");
    }

    const variantKey = this.resolveVariantKey(effectiveInput as Record<string, unknown>);
    const variant = this.state.variants[variantKey];
    if (!variant) {
      throw new PrimitiveError(`Unknown union variant "${String(variantKey)}"`);
    }

    const encoded = variant.encode(effectiveInput as InferInput<typeof variant>);
    if (encoded.kind !== "object") {
      throw new PrimitiveError("Union variant must encode to an object value");
    }
    return objectValue({
      ...encoded.fields,
      [this.state.discriminator]: stringValue(String(variantKey)),
    });
  }

  decode(value: Value | undefined): InferUnionSnapshot<TVariants> | undefined {
    if (value?.kind !== "object") {
      return undefined;
    }
    const variantKey = this.resolveVariantKeyFromObject(value);
    if (!variantKey) {
      return undefined;
    }
    const variant = this.state.variants[variantKey];
    const decoded = variant?.decode(value);
    if (decoded === undefined) {
      return undefined;
    }
    return {
      ...(decoded as object),
      [this.state.discriminator]: variantKey,
    } as InferUnionSnapshot<TVariants>;
  }

  createProxy(session: CommandSession, path: Path): UnionProxy<TVariants, TDiscriminator> {
    return {
      get: () => this.decode(getValueAtPath(session.current(), path)),
      set: (value) => {
        session.emit([{ kind: "value.set", path, value: this.encode(value) }]);
      },
      as: (variant) => {
        const primitive = this.state.variants[String(variant)];
        if (!primitive) {
          throw new PrimitiveError(`Unknown union variant "${String(variant)}"`);
        }
        return primitive.createProxy(session, path) as InferProxy<TVariants[typeof variant]>;
      },
      match: (handlers) => {
        const current = getObjectAtPath(session.current(), path);
        const variantKey = current ? this.resolveVariantKeyFromObject(current) : undefined;
        if (!variantKey) {
          return undefined;
        }
        const handler = handlers[variantKey as keyof TVariants];
        if (!handler) {
          return undefined;
        }
        return handler(
          this.state.variants[variantKey]!.createProxy(session, path) as InferProxy<
            TVariants[keyof TVariants]
          >,
        );
      },
    };
  }

  optional(stripDefaults: boolean): UnionPrimitive<TVariants, TDiscriminator, false, false> {
    return new UnionPrimitive({
      ...this.state,
      required: false,
      defaultValue: stripDefaults ? undefined : this.state.defaultValue,
    });
  }

  private resolveVariantKey(input: Record<string, unknown>): keyof TVariants {
    const discriminatorValue = input[this.state.discriminator];
    if (
      typeof discriminatorValue === "string" &&
      Object.prototype.hasOwnProperty.call(this.state.variants, discriminatorValue)
    ) {
      return discriminatorValue as keyof TVariants;
    }

    const candidates = Object.entries(this.state.variants)
      .filter(([, variant]) => {
        const variantFields = Object.keys(variant.fields);
        return Object.keys(input).every(
          (key) => key === this.state.discriminator || variantFields.includes(key),
        );
      })
      .map(([key]) => key as keyof TVariants);

    if (candidates.length === 1) {
      return candidates[0]!;
    }

    throw new PrimitiveError("Unable to resolve union variant from input");
  }

  private resolveVariantKeyFromObject(value: ObjectValue): keyof TVariants | undefined {
    const discriminator = value.fields[this.state.discriminator];
    if (discriminator?.kind !== "string") {
      return undefined;
    }
    if (!Object.prototype.hasOwnProperty.call(this.state.variants, discriminator.value)) {
      return undefined;
    }
    return discriminator.value as keyof TVariants;
  }
}

export const Union = <TVariants extends UnionVariants, TDiscriminator extends string = "type">(
  variants: TVariants,
  options?: { discriminator?: TDiscriminator },
): UnionPrimitive<TVariants, TDiscriminator, false, false> =>
  new UnionPrimitive({
    required: false,
    defaultValue: undefined,
    discriminator: options?.discriminator ?? ("type" as TDiscriminator),
    variants,
  });
