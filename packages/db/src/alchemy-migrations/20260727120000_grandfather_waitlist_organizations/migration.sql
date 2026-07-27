-- The `waitlist` internal feature flag defaults to ON so that every newly
-- created organization is held on the waitlist. Grandfather every organization
-- that already exists at the time of this migration by writing an explicit
-- `false` override, so the flag never locks out current customers.
--
-- The id mirrors `generateId("internalFeatureFlagOverride")`: the `iff_ovr_`
-- prefix plus 24 characters, which fits the varchar(36) primary key.
INSERT INTO "internal_feature_flag_override" ("id", "organization_id", "flag_key", "enabled", "created_at")
SELECT
	'iff_ovr_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 24),
	"organization"."id",
	'waitlist',
	false,
	now()
FROM "organization"
ON CONFLICT DO NOTHING;
