import type {
  ArrayValue,
  BooleanValue,
  NumberValue,
  ObjectValue,
  StringValue,
  TreeValue,
  Value,
} from "../core/types.ts";

export const SchemaKinds = {
  String: "string",
  Number: "number",
  Boolean: "boolean",
  Literal: "literal",
  Object: "object",
  Array: "array",
  Union: "union",
  Either: "either",
  Tree: "tree",
} as const;

export type SchemaKind = (typeof SchemaKinds)[keyof typeof SchemaKinds];

export type ValueObject = Value;
export type ValueObjectString = StringValue;
export type ValueObjectNumber = NumberValue;
export type ValueObjectBoolean = BooleanValue;
export type ValueObjectObject = ObjectValue;
export type ValueObjectArray = ArrayValue;
export type ValueObjectTree = TreeValue;

export interface MinLengthStringValidator {
  readonly kind: "minLength";
  readonly value: number;
}

export interface MaxLengthStringValidator {
  readonly kind: "maxLength";
  readonly value: number;
}

export interface LengthStringValidator {
  readonly kind: "length";
  readonly value: number;
}

export interface RegexStringValidator {
  readonly kind: "regex";
  readonly pattern: string;
  readonly flags?: string;
}

export interface EmailStringValidator {
  readonly kind: "email";
}

export interface UrlStringValidator {
  readonly kind: "url";
}

export type StringValidator =
  | MinLengthStringValidator
  | MaxLengthStringValidator
  | LengthStringValidator
  | RegexStringValidator
  | EmailStringValidator
  | UrlStringValidator;

export interface MinNumberValidator {
  readonly kind: "min";
  readonly value: number;
}

export interface MaxNumberValidator {
  readonly kind: "max";
  readonly value: number;
}

export interface PositiveNumberValidator {
  readonly kind: "positive";
}

export interface NegativeNumberValidator {
  readonly kind: "negative";
}

export interface IntNumberValidator {
  readonly kind: "int";
}

export type NumberValidator =
  | MinNumberValidator
  | MaxNumberValidator
  | PositiveNumberValidator
  | NegativeNumberValidator
  | IntNumberValidator;

export interface MinLengthArrayValidator {
  readonly kind: "minLength";
  readonly value: number;
}

export interface MaxLengthArrayValidator {
  readonly kind: "maxLength";
  readonly value: number;
}

export type ArrayValidator = MinLengthArrayValidator | MaxLengthArrayValidator;

export interface BaseSchema {
  readonly kind: SchemaKind;
  readonly required?: boolean;
}

export interface StringSchema extends BaseSchema {
  readonly kind: "string";
  readonly default?: ValueObjectString;
  readonly validators?: readonly StringValidator[];
}

export interface NumberSchema extends BaseSchema {
  readonly kind: "number";
  readonly default?: ValueObjectNumber;
  readonly validators?: readonly NumberValidator[];
}

export interface BooleanSchema extends BaseSchema {
  readonly kind: "boolean";
  readonly default?: ValueObjectBoolean;
}

export interface LiteralSchema extends BaseSchema {
  readonly kind: "literal";
  readonly value: string | number | boolean;
  readonly default?: ValueObjectString | ValueObjectNumber | ValueObjectBoolean;
}

export interface ObjectSchema extends BaseSchema {
  readonly kind: "object";
  readonly fields: Readonly<Record<string, Schema>>;
  readonly default?: ValueObjectObject;
}

export interface ArraySchema extends BaseSchema {
  readonly kind: "array";
  readonly element: Schema;
  readonly default?: ValueObjectArray;
  readonly validators?: readonly ArrayValidator[];
}

export interface UnionSchema extends BaseSchema {
  readonly kind: "union";
  readonly discriminator: string;
  readonly variants: Readonly<Record<string, ObjectSchema>>;
  readonly default?: ValueObjectObject;
}

export interface EitherSchema extends BaseSchema {
  readonly kind: "either";
  readonly variants: readonly Schema[];
  readonly default?: ValueObject;
}

export interface TreeVariantSchema {
  readonly schema: ObjectSchema;
  readonly children: readonly string[];
}

export interface TreeSchema extends BaseSchema {
  readonly kind: "tree";
  readonly discriminator: string;
  readonly roots: readonly string[];
  readonly variants: Readonly<Record<string, TreeVariantSchema>>;
  readonly default?: ValueObjectTree;
}

export type Schema =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | LiteralSchema
  | ObjectSchema
  | ArraySchema
  | UnionSchema
  | EitherSchema
  | TreeSchema;

export type SchemaObject = Schema;
