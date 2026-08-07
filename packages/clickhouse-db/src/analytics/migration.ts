import { constant } from "@voidhash/lib/lang";

import type { MigrationSet } from "../live.ts";

import migration0001 from "../migrations/0001_create_analytics_events.ts";
import migration0002 from "../migrations/0002_create_analytics_identity_v2.ts";
import migration0003 from "../migrations/0003_create_analytics_identity_pending_overrides_v2.ts";
import migration0004 from "../migrations/0004_person_identity_cutover.ts";
import migration0005 from "../migrations/0005_align_analytics_identity_tables.ts";
import migration0006 from "../migrations/0006_repair_pending_overrides_person_id.ts";
import migration0007 from "../migrations/0007_add_organization_id_to_identity_tables.ts";
import migration0008 from "../migrations/0008_repair_identity_organization_id.ts";

export const analyticsEventsMigrations: MigrationSet = {
  migrations: [
    [1, "0001_create_analytics_events", migration0001],
    [2, "0002_create_analytics_identity_v2", migration0002],
    [3, "0003_create_analytics_identity_pending_overrides_v2", migration0003],
    [4, "0004_person_identity_cutover", migration0004],
    [5, "0005_align_analytics_identity_tables", migration0005],
    [6, "0006_repair_pending_overrides_person_id", migration0006],
    [7, "0007_add_organization_id_to_identity_tables", migration0007],
    [8, "0008_repair_identity_organization_id", migration0008],
  ],
  tableName: "analytics_migrations",
};

export const analyticsEventsMigrationRef = constant({
  name: "analyticsEvents",
  tableName: analyticsEventsMigrations.tableName,
  version: analyticsEventsMigrations.migrations.reduce((max, [id]) => Math.max(max, id), -1),
});

export type MigrationSetRef = typeof analyticsEventsMigrationRef;
