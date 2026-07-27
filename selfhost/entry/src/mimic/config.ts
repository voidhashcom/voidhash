import { makePgDocumentConfig } from "@voidhash/mimic-db/core/pg-store";
import type { PgDurableEntityConfig } from "@voidhash/platform-node/DurableEntity";
import { Redacted } from "effect";

import type { MimicNodeConfig } from "./MimicNode.ts";

const numberFromEnv = (name: string, fallback: number): number => {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
};

/** Reads the self-host mimic database configuration from environment variables. */
export const getMimicNodeConfig = (): MimicNodeConfig => {
  const host = process.env.DATABASE_HOST?.trim() || "127.0.0.1";
  const port = numberFromEnv("DATABASE_PORT", 5432);
  const database = process.env.DATABASE_NAME?.trim() || "voidhash";
  const username = process.env.DATABASE_USERNAME?.trim() || "voidhash";
  const passwordValue = process.env.DATABASE_PASSWORD ?? "password";
  const password = Redacted.make(passwordValue);
  const databaseConfig: PgDurableEntityConfig = {
    host,
    port,
    database,
    username,
    password,
  };
  const documents = makePgDocumentConfig({
    host,
    port,
    database,
    username,
    password: passwordValue,
  });
  return { database: databaseConfig, documents };
};
