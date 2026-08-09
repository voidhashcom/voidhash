/** Ephemeral infrastructure credentials injected into the backend integration smoke. */
export interface BackendTestConnections {
  readonly db: {
    readonly host: string;
    readonly port: number;
    readonly username: string;
    readonly password: string;
    readonly databaseName: string;
  };
  readonly workos: {
    readonly apiKey: string;
    readonly clientId: string;
    readonly cookieName: string;
    readonly cookiePassword: string;
    readonly webhookSecret: string;
  };
}
