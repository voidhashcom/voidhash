import { Effect, Layer, Schema, Context } from "effect";
import * as path from "node:path";
import * as fs from "node:fs";

import { loadConfigFile } from "../utils/js-loading/config-loader.js";

const CONFIG_FILE_NAMES = [
  "mimic.config.ts",
  "mimic.config.js",
  "mimic.config.cjs",
  "mimic.config.mjs",
];

const MimicConfigSchema = Schema.Struct({
  url: Schema.String,
  username: Schema.String,
  password: Schema.String,
  database: Schema.String,
});

export interface ConfigLoaderShape {
  readonly load: () => Effect.Effect<typeof MimicConfigSchema.Type, Error>;
}

export class ConfigLoader extends Context.Service<ConfigLoader, ConfigLoaderShape>()(
  "@voidhash/mimic-cli/ConfigLoader",
) {
  static Default = Layer.succeed(ConfigLoader, {
    load: () =>
      Effect.gen(function* () {
        yield* Effect.tryPromise({
          try: async () => {
            const dotenv = await import("dotenv");
            dotenv.config({ path: path.resolve(process.cwd(), ".env") });
          },
          catch: () => undefined,
        }).pipe(Effect.ignore);

        const cwd = process.cwd();
        let configPath: string | undefined;
        for (const name of CONFIG_FILE_NAMES) {
          const candidate = path.resolve(cwd, name);
          if (fs.existsSync(candidate)) {
            configPath = candidate;
            break;
          }
        }

        if (!configPath) {
          return yield* Effect.fail(
            new Error(`No mimic config file found. Create one of: ${CONFIG_FILE_NAMES.join(", ")}`),
          );
        }

        const rawConfig = yield* loadConfigFile(configPath).pipe(
          Effect.mapError((error) => new Error(`Failed to load config: ${error.message}`)),
        );

        return yield* Effect.try({
          try: () => Schema.decodeUnknownSync(MimicConfigSchema)(rawConfig),
          catch: (error) => new Error(`Invalid mimic config:\n${String(error)}`),
        });
      }),
  });
}
