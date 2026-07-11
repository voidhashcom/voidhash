import { Console, Effect } from "effect";
import { Command } from "effect/unstable/cli";
import * as fs from "node:fs";
import * as path from "node:path";

const CONFIG_TEMPLATE = `import { defineConfig, env } from "@voidhash/mimic-cli";

export default defineConfig({
  url: env.MIMIC_URL,
  username: env.MIMIC_USERNAME,
  password: env.MIMIC_PASSWORD,
  database: "my-database",
});
`;

const ENV_TEMPLATE = `MIMIC_URL=http://localhost:3000
MIMIC_USERNAME=root
MIMIC_PASSWORD=changeme
`;

export const initCommand = Command.make("init", {}, () =>
  Effect.gen(function* () {
    const cwd = process.cwd();
    const configPath = path.join(cwd, "mimic.config.ts");
    const envPath = path.join(cwd, ".env");

    if (fs.existsSync(configPath)) {
      return yield* Effect.fail(new Error("mimic.config.ts already exists in this directory."));
    }

    fs.writeFileSync(configPath, CONFIG_TEMPLATE);
    yield* Console.log("Created mimic.config.ts");

    if (!fs.existsSync(envPath)) {
      fs.writeFileSync(envPath, ENV_TEMPLATE);
      yield* Console.log("Created .env");
    } else {
      yield* Console.log(".env already exists, skipping.");
    }

    yield* Console.log("\nNext steps:");
    yield* Console.log("  1. Update .env with your server credentials");
    yield* Console.log("  2. Run 'mimic generate initial' to create your first migration");
    yield* Console.log("  3. Define collections in migrations/");
    yield* Console.log("  4. Run 'mimic migrate' to apply migrations to the server");
  }),
).pipe(Command.withDescription("Scaffold a new mimic.config.ts file"));
