ALTER TABLE "capture_project_policy"
  ADD COLUMN "builtin_event_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "capture_project_policy"
  ADD COLUMN "custom_event_blocklist" jsonb DEFAULT '[]'::jsonb NOT NULL;

-- Before this migration every install accepted the six SDK lifecycle events and
-- stored the server-trusted revenue events. The built-in registry defaults are
-- deliberately more conservative, so existing projects get explicit overrides
-- pinning today's behaviour; the conservative defaults apply to new projects
-- only. Projects without a policy row get one seeded with the column defaults.
INSERT INTO "capture_project_policy" ("project_id", "builtin_event_overrides")
SELECT
  "project"."id",
  '{
    "$app_installed": true,
    "$app_updated": true,
    "$app_opened": true,
    "$app_backgrounded": true,
    "$app_became_active": true,
    "$sign_out": true,
    "revenue": true
  }'::jsonb
FROM "project"
ON CONFLICT ("project_id") DO UPDATE SET
  "builtin_event_overrides" =
    "capture_project_policy"."builtin_event_overrides" || EXCLUDED."builtin_event_overrides";
