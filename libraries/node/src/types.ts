export type VoidhashNodeClientOptions = {
  secretKey: string;
  /**
   * The project's publishable key (`vh_pk_...`). Optional: event ingest also
   * accepts the secret key, so a server-side client only needs `secretKey`.
   * Supply it to have `analytics.capture` authorize with the publishable token
   * in the request body instead, matching the browser and mobile SDKs.
   */
  publishableKey?: string;
  baseUrl?: string;
  /** Overrides the event ingest origin. Defaults to `https://ingest.voidhash.com`. */
  ingestUrl?: string;
  headers?: Record<string, string>;
};
