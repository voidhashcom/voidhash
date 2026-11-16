export type VoidhashNodeClientOptions = {
  /** A project secret key (`vh_sk_...`), sent as `Authorization: Bearer <secretKey>`. */
  secretKey: string;
  /**
   * The project every project-scoped call acts on. Optional: without it the
   * SDK reads the key's project from the session on the first such call and
   * keeps it for the client's lifetime. Set it to skip that lookup, or when
   * the key can use several projects.
   */
  projectId?: string;
  /**
   * The project's publishable key (`vh_pk_...`). Optional: event ingest also
   * accepts the secret key, so a server-side client only needs `secretKey`.
   * Supply it to have `eventCapture.capture` authorize with the publishable token
   * in the request body instead, matching the browser and mobile SDKs.
   */
  publishableKey?: string;
  baseUrl?: string;
  /** Overrides the event ingest origin. Defaults to `https://ingest.voidhash.com`. */
  ingestUrl?: string;
  headers?: Record<string, string>;
};
