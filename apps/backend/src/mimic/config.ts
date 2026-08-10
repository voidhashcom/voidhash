import type { DbConfig } from "@voidhash/db/db";
import { makePgDocumentConfig } from "@voidhash/mimic-db/core/pg-store";
import type { PgPlatformConfig } from "@voidhash/platform-selfhost/Postgres";
import { Redacted } from "effect";

import { getSelfhostDatabaseConfig } from "../config.ts";
import type { MimicNodeConfig } from "./MimicNode.ts";

/**
 * Reads the self-host mimic database configuration. Defaults to the shared
 * application connection; the migration entrypoint passes the direct-TCP
 * connection instead, because building this host also issues DDL.
 */
export const getMimicNodeConfig = (
  connection: DbConfig = getSelfhostDatabaseConfig(),
): MimicNodeConfig => {
  const { databaseName: database, host, port, username } = connection;
  const databaseConfig: PgPlatformConfig = {
    host,
    port,
    database,
    username,
    password: Redacted.make(connection.password),
  };
  const documents = makePgDocumentConfig({
    host,
    port,
    database,
    username,
    password: connection.password,
  });
  return { database: databaseConfig, documents };
};
