/** biome-ignore-all lint/style/noNonNullAssertion: ok in this config file */
/** biome-ignore-all lint/complexity/useLiteralKeys: it is ok */
import { defineConfig } from "drizzle-kit";
export default defineConfig({
  dbCredentials:
    process.env["NODE_ENV"] === "production"
      ? {
          url: `mysql://${process.env["DATABASE_USERNAME"]}:${process.env["DATABASE_PASSWORD"]}@${process.env["DATABASE_HOST"]}/${process.env["DATABASE_NAME"]}?ssl={"rejectUnauthorized":true}`,
        }
      : {
          database: process.env["DATABASE_NAME"]!,
          host: process.env["DATABASE_HOST"]!,
          password: process.env["DATABASE_PASSWORD"]!,
          user: process.env["DATABASE_USERNAME"]!,
        },
  dialect: "mysql",
  out: "./packages/db/src/migrations",
  schema: "./packages/db/src/schema.ts",
  tablesFilter: ["!cluster_*"],
});
