import { Primitive } from "@voidhash/mimic-core";

export const m = Primitive;

export interface MimicMigrationContext<TSchema extends Primitive.AnyPrimitive> {
  readonly root: Primitive.InferProxy<TSchema>;
}

export interface MimicMigrationContextWithOldSchema<
  TOldSchema extends Primitive.AnyPrimitive,
  TSchema extends Primitive.AnyPrimitive,
> extends MimicMigrationContext<TSchema> {
  readonly oldRoot: Primitive.InferProxy<TOldSchema>;
}

export interface MimicCreateMigrationDefinition<
  TCollectionName extends string = string,
  TSchema extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
> {
  readonly kind: "create";
  readonly collection: TCollectionName;
  readonly schema: TSchema;
  readonly skipIfExists?: boolean;
}

export interface MimicUpdateMigrationDefinitionWithoutOldSchema<
  TCollectionName extends string = string,
  TSchema extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
> {
  readonly kind: "update";
  readonly collection: TCollectionName;
  readonly oldSchema?: never;
  readonly schema: TSchema;
  readonly execute?: (ctx: MimicMigrationContext<TSchema>) => void;
}

export interface MimicUpdateMigrationDefinitionWithOldSchema<
  TCollectionName extends string = string,
  TOldSchema extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
  TSchema extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
> {
  readonly kind: "update";
  readonly collection: TCollectionName;
  readonly oldSchema: TOldSchema;
  readonly schema: TSchema;
  readonly execute?: (ctx: MimicMigrationContextWithOldSchema<TOldSchema, TSchema>) => void;
}

export type MimicUpdateMigrationDefinition<
  TCollectionName extends string = string,
  TOldSchema extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
  TSchema extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
> =
  | MimicUpdateMigrationDefinitionWithoutOldSchema<TCollectionName, TSchema>
  | MimicUpdateMigrationDefinitionWithOldSchema<TCollectionName, TOldSchema, TSchema>;

export type MimicMigrationDefinition<
  TCollectionName extends string = string,
  TOldSchema extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
  TSchema extends Primitive.AnyPrimitive = Primitive.AnyPrimitive,
> =
  | MimicCreateMigrationDefinition<TCollectionName, TSchema>
  | MimicUpdateMigrationDefinition<TCollectionName, TOldSchema, TSchema>;

export interface MimicMigrationBuilder {
  readonly create: <
    TCollectionName extends string,
    TSchema extends Primitive.AnyPrimitive,
  >(migration: {
    readonly collection: TCollectionName;
    readonly schema: TSchema;
    readonly skipIfExists?: boolean;
  }) => MimicCreateMigrationDefinition<TCollectionName, TSchema>;
  readonly update: {
    <TCollectionName extends string, TSchema extends Primitive.AnyPrimitive>(migration: {
      readonly collection: TCollectionName;
      readonly oldSchema?: never;
      readonly schema: TSchema;
      readonly execute?: (ctx: MimicMigrationContext<TSchema>) => void;
    }): MimicUpdateMigrationDefinitionWithoutOldSchema<TCollectionName, TSchema>;
    <
      TCollectionName extends string,
      TOldSchema extends Primitive.AnyPrimitive,
      TSchema extends Primitive.AnyPrimitive,
    >(migration: {
      readonly collection: TCollectionName;
      readonly oldSchema: TOldSchema;
      readonly schema: TSchema;
      readonly execute?: (ctx: MimicMigrationContextWithOldSchema<TOldSchema, TSchema>) => void;
    }): MimicUpdateMigrationDefinitionWithOldSchema<TCollectionName, TOldSchema, TSchema>;
  };
}

export interface MimicConfigShape {
  readonly url: string;
  readonly username: string;
  readonly password: string;
  readonly database: string;
}

export type MimicConfig = MimicConfigShape & {
  defineMigrations: <TMigrations extends readonly MimicMigrationDefinition[]>(
    builder: (migration: MimicMigrationBuilder) => TMigrations,
  ) => TMigrations;
};

const migrationBuilder: MimicMigrationBuilder = {
  create: (migration) => ({
    kind: "create",
    ...migration,
  }),
  update: ((migration: object) => ({
    kind: "update",
    ...migration,
  })) as MimicMigrationBuilder["update"],
};

export const defineConfig = (config: MimicConfigShape): MimicConfig => ({
  ...config,
  defineMigrations: (builder) => builder(migrationBuilder),
});

export const env: Record<string, string> = new Proxy({} as Record<string, string>, {
  get(_, key: string) {
    const value = process.env[key];
    if (value === undefined) {
      throw new Error(
        `Environment variable ${key} is not set. Add it to your .env file or set it in your shell.`,
      );
    }
    return value;
  },
});
