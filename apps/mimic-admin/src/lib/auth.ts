import { Effect, Option, Schema } from "effect";

export interface Credentials {
  serverUrl: string;
  username: string;
  password: string;
}

const STORAGE_KEY = "mimic-admin-credentials";

const NonEmptyString = Schema.String.check(Schema.isMinLength(1));

/** JSON text codec used to write credentials into local storage. */
const StoredCredentials = Schema.fromJsonString(
  Schema.Struct({
    serverUrl: Schema.String,
    username: Schema.String,
    password: Schema.String,
  }),
);

/**
 * JSON text codec used to read credentials back. Every field must be present
 * and non-empty, mirroring the truthiness check the reader has always applied.
 */
const CompleteStoredCredentials = Schema.fromJsonString(
  Schema.Struct({
    serverUrl: NonEmptyString,
    username: NonEmptyString,
    password: NonEmptyString,
  }),
);

const decodeCredentials = Schema.decodeUnknownOption(CompleteStoredCredentials);
const encodeCredentials = Schema.encodeSync(StoredCredentials);

/** Reads a raw storage entry, yielding `null` when storage is unavailable. */
const readStorage = (key: string): string | null =>
  Effect.runSync(
    Effect.try(() => window.localStorage.getItem(key)).pipe(Effect.orElseSucceed(() => null)),
  );

/** Returns the stored operator credentials, or `null` when none are usable. */
export function getCredentials(): Credentials | null {
  const raw = readStorage(STORAGE_KEY);
  if (!raw) return null;
  return Option.getOrNull(decodeCredentials(raw));
}

/** Persists the operator credentials for subsequent sessions. */
export function setCredentials(credentials: Credentials): void {
  window.localStorage.setItem(STORAGE_KEY, encodeCredentials(credentials));
}

/** Removes any persisted operator credentials. */
export function clearCredentials(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
