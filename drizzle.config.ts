import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: "./packages/db/src/alchemy-migrations",
  schema: "./packages/db/src/schema.ts",
  tablesFilter: ["!cluster_*", "!mimic_*", "!effect_sql_migrations"],
});
