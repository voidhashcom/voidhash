import { Effect } from "effect";
import { SqlClient } from "effect/unstable/sql";

import { constant } from "@voidhash/lib/lang";

import { ClickhouseWebClient } from "../clickhouse-client-web/index.ts";

const statements = constant([]);

export default Effect.gen(function* () {
  const ch = yield* ClickhouseWebClient.ClickhouseWebClient;
  const sql = yield* SqlClient.SqlClient;

  for (const statement of statements) {
    yield* ch.asCommand(sql`${sql.literal(statement)}`);
  }
});
