import { Console, Effect } from "effect";
import { Argument, Command } from "effect/unstable/cli";
import * as fs from "node:fs";
import * as path from "node:path";

const MIGRATIONS_DIR = "migrations";
const MIGRATION_FILE_PATTERN = /^(\d+)_.*\.(?:[cm]?[jt]s)$/;

const slugify = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "migration";

const nextVersion = (cwd: string): number => {
  const migrationsDir = path.join(cwd, MIGRATIONS_DIR);
  if (!fs.existsSync(migrationsDir)) {
    return 1;
  }

  const versions = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && MIGRATION_FILE_PATTERN.test(entry.name))
    .map((entry) => Number.parseInt(entry.name.match(MIGRATION_FILE_PATTERN)![1]!, 10));

  return (versions.length === 0 ? 0 : Math.max(...versions)) + 1;
};

const renderTemplate = (): string => `import mimicConfig from "../mimic.config";

export default mimicConfig.defineMigrations((migration) => [
]);
`;

export const generateCommand = Command.make(
  "generate",
  {
    name: Argument.string("name"),
  },
  ({ name }) =>
    Effect.gen(function* () {
      const cwd = process.cwd();
      const migrationsDir = path.join(cwd, MIGRATIONS_DIR);
      const version = nextVersion(cwd);
      const fileName = `${String(version).padStart(5, "0")}_${slugify(name)}.ts`;
      const filePath = path.join(migrationsDir, fileName);

      if (fs.existsSync(filePath)) {
        return yield* Effect.fail(new Error(`Migration file "${fileName}" already exists.`));
      }

      fs.mkdirSync(migrationsDir, { recursive: true });
      fs.writeFileSync(filePath, renderTemplate());

      yield* Console.log(`Created ${path.relative(cwd, filePath)}`);
    }),
).pipe(Command.withDescription("Create a new empty migration file"));
