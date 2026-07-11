import { createHash } from "node:crypto";
import { Effect, Layer, Context } from "effect";
import * as fs from "node:fs";
import * as path from "node:path";
import { Primitive, serializeSchema, type SchemaObject } from "@voidhash/mimic-core";

import type {
  MimicCreateMigrationDefinition,
  MimicMigrationDefinition,
  MimicUpdateMigrationDefinition,
  MimicUpdateMigrationDefinitionWithOldSchema,
} from "../index.js";
import { loadConfigFile } from "../utils/js-loading/config-loader.js";
import { MigrationBundler } from "./MigrationBundler.js";

const MIGRATIONS_DIR_NAME = "migrations";
const MIGRATION_FILE_PATTERN = /^(\d+)_([^.]+)\.(?:[cm]?[jt]s)$/;

export interface CompiledCreateMigrationChange {
  readonly type: "create";
  readonly collection: string;
  readonly schema: SchemaObject;
  readonly skipIfExists?: boolean;
}

export interface CompiledUpdateMigrationChange {
  readonly type: "update";
  readonly collection: string;
  readonly schema: SchemaObject;
  readonly oldSchema?: SchemaObject;
  readonly dataMigrationSource?: string;
}

export type CompiledMigrationChange = CompiledCreateMigrationChange | CompiledUpdateMigrationChange;

export interface CompiledMigrationFile {
  readonly version: number;
  readonly name: string;
  readonly filePath: string;
  readonly checksum: string;
  readonly changes: readonly CompiledMigrationChange[];
}

const parseMigrationFileName = (
  fileName: string,
): { readonly version: number; readonly name: string } => {
  const match = fileName.match(MIGRATION_FILE_PATTERN);
  if (!match) {
    throw new Error(`Invalid migration filename "${fileName}". Expected "<version>_name.ts".`);
  }

  return {
    version: Number.parseInt(match[1]!, 10),
    name: match[2]!,
  };
};

const computeChecksum = (contents: string): string =>
  createHash("sha256").update(contents).digest("hex");

const loadMigrationDefinitions = (
  filePath: string,
): Effect.Effect<readonly MimicMigrationDefinition[], Error> =>
  loadConfigFile(filePath).pipe(
    Effect.mapError((error) => (error instanceof Error ? error : new Error(String(error)))),
    Effect.flatMap((value) =>
      Effect.try({
        try: () => {
          if (!Array.isArray(value)) {
            throw new Error(`Migration file "${filePath}" must export a default array.`);
          }
          return value as readonly MimicMigrationDefinition[];
        },
        catch: (error) => (error instanceof Error ? error : new Error(String(error))),
      }),
    ),
  );

const compileCreateChange = (
  definition: MimicCreateMigrationDefinition,
): CompiledCreateMigrationChange => ({
  type: "create",
  collection: definition.collection,
  schema: serializeSchema(definition.schema.schema),
  skipIfExists: definition.skipIfExists,
});

const hasOldSchema = (
  definition: MimicUpdateMigrationDefinition,
): definition is MimicUpdateMigrationDefinitionWithOldSchema => "oldSchema" in definition;

const compileUpdateChange = (
  definition: MimicUpdateMigrationDefinition,
  bundler: MigrationBundlerShape,
  filePath: string,
  index: number,
): Effect.Effect<CompiledUpdateMigrationChange, Error> =>
  Effect.gen(function* () {
    return {
      type: "update",
      collection: definition.collection,
      schema: serializeSchema(definition.schema.schema),
      oldSchema: hasOldSchema(definition)
        ? serializeSchema(definition.oldSchema.schema)
        : undefined,
      dataMigrationSource: definition.execute ? yield* bundler.bundle(filePath, index) : undefined,
    };
  });

type MigrationBundlerShape = {
  readonly bundle: (filePath: string, index: number) => Effect.Effect<string, Error>;
};

const compileMigrationFile = (
  bundler: MigrationBundlerShape,
  filePath: string,
): Effect.Effect<CompiledMigrationFile, Error> =>
  Effect.gen(function* () {
    const fileName = path.basename(filePath);
    const { version, name } = parseMigrationFileName(fileName);
    const source = yield* Effect.try({
      try: () => fs.readFileSync(filePath, "utf8"),
      catch: (error) => (error instanceof Error ? error : new Error(String(error))),
    });
    const definitions = yield* loadMigrationDefinitions(filePath);
    const changes: CompiledMigrationChange[] = [];

    for (const [index, definition] of definitions.entries()) {
      if (definition.kind === "create") {
        changes.push(compileCreateChange(definition));
      } else {
        changes.push(yield* compileUpdateChange(definition, bundler, filePath, index));
      }
    }

    return {
      version,
      name,
      filePath,
      checksum: computeChecksum(source),
      changes,
    };
  });

export interface MigrationLoaderShape {
  readonly load: () => Effect.Effect<readonly CompiledMigrationFile[], Error, MigrationBundler>;
}

export class MigrationLoader extends Context.Service<MigrationLoader, MigrationLoaderShape>()(
  "@voidhash/mimic-cli/MigrationLoader",
) {
  static Default = Layer.succeed(MigrationLoader, {
    load: () =>
      Effect.gen(function* () {
        const bundler = yield* MigrationBundler;
        const migrationsDir = path.resolve(process.cwd(), MIGRATIONS_DIR_NAME);
        if (!fs.existsSync(migrationsDir)) {
          return [] as const;
        }

        const filePaths = yield* Effect.try({
          try: () =>
            fs
              .readdirSync(migrationsDir, { withFileTypes: true })
              .filter((entry) => entry.isFile() && MIGRATION_FILE_PATTERN.test(entry.name))
              .map((entry) => path.join(migrationsDir, entry.name))
              .sort(),
          catch: (error) => (error instanceof Error ? error : new Error(String(error))),
        });

        const compiled: CompiledMigrationFile[] = [];
        for (const filePath of filePaths) {
          compiled.push(yield* compileMigrationFile(bundler, filePath));
        }
        return compiled;
      }),
  });
}
