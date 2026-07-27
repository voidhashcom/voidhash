/**
 * Runtime configuration for mimic-db.
 *
 * Values are read from `process.env` in every supported platform entry point.
 */

export interface MimicConfig {
  /** Bootstrap superuser, created on first control-plane access. */
  readonly rootUsername: string;
  readonly rootPassword: string;
  /** Allowed CORS origins for the RPC + WebSocket endpoints. */
  readonly corsOrigins: readonly string[];
  /** Take a durable snapshot after this many appended commands. */
  readonly snapshotEveryCommands: number;
  /** WebSocket heartbeat interval (ms). */
  readonly heartbeatMs: number;
  /** Presence entry time-to-live (ms). */
  readonly presenceTtlMs: number;
  /**
   * Debounce window (ms) after the last authenticated collaborator disconnects
   * before a dirty document publishes an idle notification. Absorbs quick
   * reconnects so a single reload does not fire a notification.
   */
  readonly idleNotifyDebounceMs: number;
  /**
   * Public base URL used as the primary authority for document-token
   * connection URLs. `undefined` when `MIMIC_PUBLIC_BASE_URL` is unset or
   * blank — callers then derive scheme/host from the incoming request.
   */
  readonly publicBaseUrl: string | undefined;
}

const positiveInt = (value: string | undefined, fallback: number): number => {
  if (!value || value.trim() === "") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const DEFAULT_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "http://localhost:4460",
  "http://localhost:3003",
] as const;

export const getCorsAllowedOrigins = (): readonly string[] => {
  const env = process.env.CORS_ORIGINS?.trim();
  if (!env) return DEFAULT_CORS_ORIGINS;
  return env
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

export const getConfig = (): MimicConfig => ({
  rootUsername: process.env.ROOT_USERNAME?.trim() || "root",
  rootPassword: process.env.ROOT_PASSWORD ?? "password",
  corsOrigins: getCorsAllowedOrigins(),
  snapshotEveryCommands: positiveInt(process.env.MIMIC_DOCUMENT_SNAPSHOT_EVERY_COMMANDS, 100),
  heartbeatMs: positiveInt(process.env.MIMIC_DOCUMENT_HEARTBEAT_MS, 30_000),
  presenceTtlMs: positiveInt(process.env.MIMIC_DOCUMENT_PRESENCE_TTL_MS, 75_000),
  idleNotifyDebounceMs: positiveInt(process.env.MIMIC_DOCUMENT_IDLE_NOTIFY_DEBOUNCE_MS, 15_000),
  publicBaseUrl: process.env.MIMIC_PUBLIC_BASE_URL?.trim() || undefined,
});
