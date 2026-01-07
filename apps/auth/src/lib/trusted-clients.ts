import { env } from "./env";

export interface TrustedClientConfig {
  clientId: string;
  clientSecret: string;
  name: string;
  type: "web" | "native" | "user-agent-based";
  redirectUris: string[];
  disabled: boolean;
  skipConsent: boolean;
  enable_end_session: boolean;
  metadata?: Record<string, unknown>;
}

export const TRUSTED_CLIENTS: TrustedClientConfig[] = [
  {
    clientId: env.VOIDHASH_STUDIO_CLIENT_ID,
    clientSecret: env.VOIDHASH_STUDIO_CLIENT_SECRET,
    disabled: false,
    enable_end_session: true,
    metadata: { internal: true },
    name: "Voidhash Studio",
    redirectUris: [env.VOIDHASH_STUDIO_REDIRECT_URL],
    skipConsent: true,
    type: "web",
  },
  {
    clientId: env.VOIDHASH_MOBILE_CLIENT_ID,
    clientSecret: env.VOIDHASH_MOBILE_CLIENT_SECRET,
    disabled: false,
    enable_end_session: false,
    metadata: { internal: true },
    name: "Voidhash Mobile",
    redirectUris: [
      // Production - custom scheme
      "voidhash://auth/callback",
      // Development - custom scheme with path
      ...(process.env.NEXT_PUBLIC_VERCEL_ENV === "development"
        ? [
            "http://localhost:8081/auth/callback",
            "voidhash-dev://auth/callback",
          ]
        : []),
    ],
    skipConsent: true,
    type: "native",
  },
];

// Set of trusted client IDs for caching
export const CACHED_TRUSTED_CLIENT_IDS = new Set(
  TRUSTED_CLIENTS.map((c) => c.clientId)
);
