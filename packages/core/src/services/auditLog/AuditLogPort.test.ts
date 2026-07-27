import { AuditLogAction, AuditLogEntityType } from "@voidhash/db";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { AuditLogPort } from "./AuditLogPort.ts";

describe("AuditLogPort", () => {
  it("provides a no-op community extension", async () => {
    const program = Effect.gen(function* () {
      const auditLog = yield* AuditLogPort;
      yield* auditLog.append({
        action: AuditLogAction.Created,
        entityId: "project_1",
        entityType: AuditLogEntityType.Project,
        projectId: "project_1",
      });
    }).pipe(Effect.provide(AuditLogPort.noop));

    await expect(Effect.runPromise(program)).resolves.toBeUndefined();
  });
});
