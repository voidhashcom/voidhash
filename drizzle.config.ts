import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  out: "./packages/db/src/alchemy-migrations",
  schema: "./packages/db/src/schema.ts",
  tablesFilter: [
    "!cluster_*",
    "!mimic_*",
    "!effect_sql_migrations",
    // Cloud-billing tables are owned by the hosting deployment and may still
    // exist (with live data) in databases this schema is applied to. They are
    // absent from `schema.ts` but present in the newest tracked snapshot, so
    // without these filters `db:generate` would propose DROP TABLE for them.
    // See `packages/db/src/alchemy-migrations/20260728120000_remove_billing_tables/`.
    // Do not remove.
    "!organization_billing",
    "!usage_record",
    "!usage_aggregate",
    "!billing_webhook_event",
    "!billing_provider_meter",
  ],
});
