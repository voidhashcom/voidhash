import { build, type Plugin } from "esbuild";
import { Effect, Layer, Context } from "effect";
import * as path from "node:path";
import { PACKAGE_ROOT } from "../utils/package-root.js";

const MIGRATION_RUNNER_GLOBAL = "__MIMIC_RUN_MIGRATION__";
const PUBLIC_ROOT = path.resolve(PACKAGE_ROOT, "../..");

const workspaceSourcePlugin: Plugin = {
  name: "workspace-source",
  setup(buildContext) {
    const mappings: Record<string, string> = {
      "@voidhash/mimic-cli": path.resolve(PACKAGE_ROOT, "src/index.ts"),
      "@voidhash/mimic-core": path.resolve(
        PUBLIC_ROOT,
        "packages/mimic-core/src/index.ts",
      ),
      "@voidhash/mimic-server/migrate": path.resolve(
        PUBLIC_ROOT,
        "packages/mimic-server/src/migrate/index.ts",
      ),
    };

    buildContext.onResolve({ filter: /^@voidhash\// }, (args) => {
      const mapped = mappings[args.path];
      if (mapped) {
        return { path: mapped };
      }
      return undefined;
    });
  },
};

const renderEntrySource = (filePath: string, index: number): string => `
  import migrations from ${JSON.stringify(filePath)};
  import {
    applyBatch,
    createGenerator,
    validate as validateSchema,
    validateValue,
  } from "@voidhash/mimic-core";
  import { reconcileMigrationValue } from "@voidhash/mimic-server/migrate";

  const definition = migrations[${index}];

  globalThis.${MIGRATION_RUNNER_GLOBAL} = (input) => {
    if (!definition || definition.kind !== "update" || typeof definition.execute !== "function") {
      throw new Error("Migration definition is not executable");
    }

    validateValue(input.oldValue);

    const oldPrimitive = "oldSchema" in definition ? definition.oldSchema : undefined;
    const newPrimitive = definition.schema;

    let currentValue = input.oldValue;

    try {
      if (oldPrimitive) {
        const reconciled = reconcileMigrationValue({
          oldSchema: oldPrimitive.schema,
          newSchema: newPrimitive.schema,
          value: input.oldValue,
        });
        if (reconciled.ok && reconciled.value !== undefined) {
          currentValue = reconciled.value;
        }
      } else {
        const sanitized = validateSchema(newPrimitive.schema, input.oldValue);
        if (sanitized !== undefined) {
          currentValue = sanitized;
        }
      }
    } catch {}

    const generator = createGenerator();
    const staged = [];
    const session = {
      current: () => currentValue,
      emit: (commands) => {
        if (commands.length === 0) {
          return;
        }
        staged.push(...commands);
        currentValue = applyBatch(currentValue, commands);
      },
      generator: {
        nextArrayItemId: () => globalThis.crypto.randomUUID(),
        nextTreeNodeId: () => globalThis.crypto.randomUUID(),
        between: (lower, upper) => generator.between(lower, upper),
      },
    };

    const readOnlySession = {
      current: () => input.oldValue,
      emit: () => {
        throw new Error("oldRoot is read-only");
      },
      generator: session.generator,
    };

    const ctx = {
      root: newPrimitive.createProxy(session, []),
    };

    if (oldPrimitive) {
      ctx.oldRoot = oldPrimitive.createProxy(readOnlySession, []);
    }

    definition.execute(ctx);

    const sanitized = validateSchema(newPrimitive.schema, currentValue);
    if (sanitized === undefined) {
      throw new Error("Migration produced an undefined root value");
    }

    return { value: sanitized };
  };
`;

export interface MigrationBundlerShape {
  readonly bundle: (filePath: string, index: number) => Effect.Effect<string, Error>;
}

export class MigrationBundler extends Context.Service<MigrationBundler, MigrationBundlerShape>()(
  "@voidhash/mimic-cli/MigrationBundler",
) {
  static Default = Layer.succeed(MigrationBundler, {
    bundle: (filePath, index) =>
      Effect.tryPromise({
        try: async () => {
          const result = await build({
            absWorkingDir: process.cwd(),
            bundle: true,
            format: "iife",
            minify: true,
            platform: "browser",
            target: "es2022",
            write: false,
            plugins: [workspaceSourcePlugin],
            stdin: {
              contents: renderEntrySource(filePath, index),
              loader: "ts",
              resolveDir: path.dirname(filePath),
              sourcefile: `${path.basename(filePath)}.generated.ts`,
            },
          });

          const output = result.outputFiles[0]?.text;
          if (!output) {
            throw new Error(`Failed to build migration bundle for "${filePath}".`);
          }
          return output;
        },
        catch: (error) => (error instanceof Error ? error : new Error(String(error))),
      }),
  });
}

export const MigrationBundlerRuntime = {
  globalName: MIGRATION_RUNNER_GLOBAL,
};
