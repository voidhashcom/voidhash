export type VoidhashNodeClientOptions = {
  secretKey: string;
  /**
   * The project's publishable key (`vh_pk_...`). Required only for
   * `analytics.capture`: event ingest authenticates on the publishable key in
   * the request body rather than on the secret key.
   */
  publishableKey?: string;
  baseUrl?: string;
  /** Overrides the event ingest origin. Defaults to `https://ingest.voidhash.com`. */
  ingestUrl?: string;
  headers?: Record<string, string | undefined>;
};
