import { describe, expect, it } from "vite-plus/test";

import { analyticsEventsMigrations } from "../analytics/migration.ts";
import { buildAddPendingOverridePersonIdStatement } from "./0006_repair_pending_overrides_person_id.ts";

describe("migration0006", () => {
  it("adds a person_id compatibility column from legacy customer_id", () => {
    expect(buildAddPendingOverridePersonIdStatement("person_identity_pending_overrides_v2")).toBe(
      "ALTER TABLE person_identity_pending_overrides_v2 ADD COLUMN IF NOT EXISTS person_id String DEFAULT customer_id AFTER customer_id",
    );
  });

  it("is registered after the earlier alignment migration", () => {
    expect(analyticsEventsMigrations.migrations.map(([id, name]) => [id, name])).toContainEqual([
      6,
      "0006_repair_pending_overrides_person_id",
    ]);
  });
});
