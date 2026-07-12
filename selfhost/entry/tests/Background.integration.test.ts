import { Db, sql } from "@voidhash/db";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

import { makeSelfhostAnalyticsRuntimeLive } from "../src/backend/Analytics.ts";
import { runSelfhostCronJobs } from "../src/backend/Background.ts";
import { getSelfhostRuntimeConfig } from "../src/config.ts";

const describePg = process.env.SELFHOST_PG_TEST === "1" ? describe : describe.skip;
const requiredJobNames = [
  "app-store-expire-parked-notifications",
  "purchase-ledger-drain",
] as const;

describePg("self-host scheduled jobs", () => {
  it("registers persistent schedule state for the required background jobs", async () => {
    const config = getSelfhostRuntimeConfig();
    const database = Db.layer(config.database);
    let names: ReadonlyArray<string> = [];

    try {
      names = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* () {
            const db = yield* Db;
            yield* Effect.forkScoped(runSelfhostCronJobs(config));
            const deadline = Date.now() + 10_000;
            while (Date.now() < deadline) {
              const rows = yield* db
                .execute(sql`
                  SELECT job_name AS "jobName"
                  FROM platform_cron_state
                  WHERE job_name IN (
                    'app-store-expire-parked-notifications',
                    'purchase-ledger-drain'
                  )
                  ORDER BY job_name
                `)
                .pipe(Effect.catch(() => Effect.succeed([])));
              const registered = rows.map((row) => String(row.jobName));
              if (registered.length === requiredJobNames.length) return registered;
              yield* Effect.sleep("25 millis");
            }
            return [];
          }).pipe(
            Effect.provide(database),
            Effect.provide(makeSelfhostAnalyticsRuntimeLive(config)),
          ),
        ),
      );
    } finally {
      await Effect.runPromise(
        Effect.gen(function* () {
          const db = yield* Db;
          yield* db.execute(sql`
            DELETE FROM platform_cron_state
            WHERE job_name IN (
              'app-store-expire-parked-notifications',
              'purchase-ledger-drain'
            )
          `);
        }).pipe(Effect.provide(database)),
      );
    }

    expect(names).toEqual(requiredJobNames);
  });
});
