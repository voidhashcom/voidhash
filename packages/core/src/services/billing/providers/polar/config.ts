import { Context } from "effect";

/**
 * Polar.sh configuration
 */
export interface PolarConfig {
  /**
   * Polar API access token
   */
  accessToken: string;

  /**
   * Polar organization ID (Voidhash's organization on Polar)
   */
  organizationId: string;

  /**
   * Webhook secret for signature verification
   */
  webhookSecret: string;

  /**
   * Whether to use sandbox environment
   */
  sandbox?: boolean;

  /**
   * Product IDs for each tier
   */
  tierProductIds: {
    pro: string;
    enterprise: string;
  };
}

/**
 * Effect Context Tag for PolarConfig
 */
export class PolarConfigService extends Context.Tag("PolarConfigService")<
  PolarConfigService,
  PolarConfig
>() {}
