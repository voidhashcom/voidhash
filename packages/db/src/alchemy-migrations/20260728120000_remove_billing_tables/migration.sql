-- Cloud billing left this repository: `organization_billing`, `usage_record`,
-- `usage_aggregate`, `billing_webhook_event` and `billing_provider_meter` are
-- no longer declared in `packages/db/src/schema.ts`.
--
-- Deliberately NOT a set of DROP TABLE statements. Those tables are owned by
-- the hosting deployment now — it keeps its own schema for them and their data
-- must survive this release. Self-hosted deployments simply never create them.
-- `drizzle.config.ts` excludes them via `tablesFilter` so future generates do
-- not re-propose the drops.
SELECT 1;
