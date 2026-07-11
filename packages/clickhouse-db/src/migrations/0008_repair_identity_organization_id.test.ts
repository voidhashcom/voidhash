import { describe, expect, it } from "vite-plus/test";

import { analyticsEventsMigrations } from "../analytics/migration.ts";
import {
  buildAddOrganizationIdStatement,
  buildBackfillOrganizationIdStatement,
  buildCreateOrgBackfillJoinStatement,
  buildPopulateOrgBackfillJoinStatement,
} from "./0008_repair_identity_organization_id.ts";

describe("migration0008", () => {
  it("adds the organization_id compatibility column", () => {
    expect(buildAddOrganizationIdStatement("person_identity_pending_overrides_v2")).toBe(
      "ALTER TABLE person_identity_pending_overrides_v2 ADD COLUMN IF NOT EXISTS organization_id String DEFAULT '' AFTER project_id",
    );
  });

  it("builds the transient backfill join", () => {
    expect(buildCreateOrgBackfillJoinStatement("person_org_backfill_join_0008")).toContain(
      "ENGINE = Join(ANY, LEFT, project_id)",
    );
    expect(buildPopulateOrgBackfillJoinStatement("person_org_backfill_join_0008")).toContain(
      "FROM events_v2",
    );
    expect(
      buildBackfillOrganizationIdStatement(
        "person_identity_pending_overrides_v2",
        "person_org_backfill_join_0008",
      ),
    ).toContain("SETTINGS mutations_sync = 1");
  });

  it("is registered after the original organization-id migration", () => {
    expect(analyticsEventsMigrations.migrations.map(([id, name]) => [id, name])).toContainEqual([
      8,
      "0008_repair_identity_organization_id",
    ]);
  });
});
