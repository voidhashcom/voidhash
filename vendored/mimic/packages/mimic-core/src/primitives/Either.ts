import { type Path, type Value } from "../core/types.ts";
import { getValueAtPath } from "./path.ts";
import {
  PrimitiveError,
  type AnyPrimitive,
  type CommandSession,
  type InferInput,
  type InferSnapshot,
  type MaybeUndefined,
  type PrimitiveWithOptionalEncoding,
} from "./shared.ts";

export type ScalarPrimitive = AnyPrimitive;

export interface EitherProxy<TVariants extends readonly AnyPrimitive[]> {
  get(): InferSnapshot<EitherPrimitive<TVariants>> | undefined;
  set(value: InferInput<EitherPrimitive<TVariants>>): void;
  update(value: InferInput<EitherPrimitive<TVariants>>): void;
}

interface EitherPrimitiveSchema<TVariants extends readonly AnyPrimitive[]> {
  readonly required: boolean;
  readonly defaultValue: InferInput<EitherPrimitive<TVariants>> | undefined;
  readonly variants: TVariants;
}

export class EitherPrimitive<
  TVariants extends readonly AnyPrimitive[],
  TRequired extends boolean = false,
  THasDefault extends boolean = false,
> implements PrimitiveWithOptionalEncoding<
  InferInput<TVariants[number]> | undefined,
  MaybeUndefined<Exclude<InferSnapshot<TVariants[number]>, undefined>, TRequired, THasDefault>,
  EitherProxy<TVariants>
> {
  readonly _tag = "EitherPrimitive";
  readonly _Input!: InferInput<TVariants[number]> | undefined;
  readonly _Snapshot!: MaybeUndefined<
    Exclude<InferSnapshot<TVariants[number]>, undefined>,
    TRequired,
    THasDefault
  >;
  readonly _Proxy!: EitherProxy<TVariants>;

  private readonly state: EitherPrimitiveSchema<TVariants>;

  constructor(state: EitherPrimitiveSchema<TVariants>) {
    this.state = state;
    if (state.variants.length === 0) {
      throw new PrimitiveError("Either requires at least one variant");
    }
  }

  get schema() {
    return {
      kind: "either" as const,
      variants: this.state.variants.map((variant) => variant.schema),
      ...(this.state.required ? { required: true } : {}),
      ...(this.state.defaultValue !== undefined
        ? { default: this.encode(this.state.defaultValue) }
        : {}),
    };
  }

  required(): EitherPrimitive<TVariants, true, THasDefault> {
    return new EitherPrimitive({
      ...this.state,
      required: true,
    });
  }

  default(
    defaultValue: InferInput<EitherPrimitive<TVariants>>,
  ): EitherPrimitive<TVariants, TRequired, true> {
    return new EitherPrimitive({
      ...this.state,
      defaultValue,
    });
  }

  encode(input: InferInput<EitherPrimitive<TVariants>> | undefined): Value {
    const encoded = this.encodeOptional(input);
    if (encoded === undefined) {
      throw new PrimitiveError("Either value is undefined");
    }
    return encoded;
  }

  encodeOptional(input: unknown): Value | undefined {
    const effectiveInput = input === undefined ? this.state.defaultValue : input;
    if (effectiveInput === undefined) {
      if (this.state.required) {
        throw new PrimitiveError("Either value is required");
      }
      return undefined;
    }

    for (const variant of this.state.variants) {
      try {
        const encoded = variant.encodeOptional(effectiveInput);
        if (encoded !== undefined) {
          return encoded;
        }
      } catch {
        // try next variant
      }
    }

    throw new PrimitiveError("Either input did not match any variant");
  }

  decode(value: Value | undefined): InferSnapshot<EitherPrimitive<TVariants>> | undefined {
    for (const variant of this.state.variants) {
      const decoded = variant.decode(value);
      if (decoded !== undefined) {
        return decoded as InferSnapshot<EitherPrimitive<TVariants>>;
      }
    }
    return undefined;
  }

  createProxy(session: CommandSession, path: Path): EitherProxy<TVariants> {
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

  optional(stripDefaults: boolean): EitherPrimitive<TVariants, false, false> {
    return new EitherPrimitive({
      ...this.state,
      required: false,
      defaultValue: stripDefaults ? undefined : this.state.defaultValue,
    });
  }
}

export const Either = <TVariants extends readonly AnyPrimitive[]>(
  ...variants: TVariants
): EitherPrimitive<TVariants, false, false> =>
  new EitherPrimitive({
    required: false,
    defaultValue: undefined,
    variants,
  });
