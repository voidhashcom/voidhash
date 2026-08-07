import { AuditLogAction, AuditLogEntityType } from "@voidhash/db";
import { Effect } from "effect";

import { describe, expect, it } from "../../testing/effect-vitest.ts";
import { AuditLogPort } from "./AuditLogPort.ts";

describe("AuditLogPort", () => {
  it.effect("provides a no-op community extension", () =>
    Effect.gen(function* () {
      const auditLog = yield* AuditLogPort;
      const result = yield* auditLog.append({
        action: AuditLogAction.Created,
        entityId: "project_1",
        entityType: AuditLogEntityType.Project,
        projectId: "project_1",
      });

      expect(result).toBeUndefined();
    }).pipe(Effect.provide(AuditLogPort.noop)),
  );
});
