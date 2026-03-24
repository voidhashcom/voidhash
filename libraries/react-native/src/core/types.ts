// Parts are ripped from https://github.com/pingdotgg/uploadthing/blob/main/packages/shared/src/types.ts

/**
 * A subset of the standard RequestInit properties needed by voidhash internally.
 * @see RequestInit from lib.dom.d.ts
 */
export interface RequestInitEsque {
  /**
   * Sets the request's body.
   */
  body?: FormData | ReadableStream | string | null;

  /**
   * Sets the request's associated headers.
   */
  headers?: [string, string][] | Record<string, string>;

  /**
   * The request's HTTP-style method.
   */
  method?: string;
}

/**
 * A subset of the standard Response properties needed by voidhash internally.
 * @see Response from lib.dom.d.ts
 */
export interface ResponseEsque {
  status: number;
  statusText: string;
  ok: boolean;
  /**
   * @remarks
   * The built-in Response::json() method returns Promise<any>, but
   * that's not as type-safe as unknown. We use unknown because we're
   * more type-safe. You do want more type safety, right? 😉
   */
  json: <T = unknown>() => Promise<T>;
  text: () => Promise<string>;
  blob: () => Promise<Blob>;
  body: ReadableStream | null;

  headers: Headers;

  clone: () => ResponseEsque;
}

export type MaybeUrl = string | URL;

/**
 * A subset of the standard fetch function type needed by voidhash internally.
 * @see fetch from lib.dom.d.ts
 */
export type FetchEsque = (
  input: RequestInfo | MaybeUrl,
  init?: RequestInit | RequestInitEsque
) => Promise<ResponseEsque>;

// API
export interface CustomerResponse {
  customerId: string;
  name: null;
  email: null;
  distinctId: null;
}

export interface PaywallProduct {
  paywallProductId: string;
  productId: string;
  displayName: string;
  price: null | number;
  nativePurchaseAvailable: boolean;
  webCheckoutAvailable: boolean;
}

export interface ConfigurationResponse {
  paywalls: {
    paywallId: string;
    paywallProducts: {
      paywallProductId: string;
      productId: string;
      displayName: string;
      nativePaymentProviderConfigurationProductId: string | null;
      defaultWebCheckoutPaymentProviderConfigurationProductId: string | null;
      paymentProviderConfigurationProducts: {
        paymentProviderConfigurationProductId: string;
        paymentProviderConfigurationId: string;
        // biome-ignore lint/suspicious/noExplicitAny: ok
        configuration: Record<string, any>;
      }[];
    }[];
  }[];
  paywallLocations: {
    paywallLocationId: string;
    slug: string;
  }[];
  placements: {
    paywallId: string;
    paywallLocationId: string;
  }[];
  paymentProviderConfigurations: {
    paymentProviderConfigurationId: string;
    providerId: string;
  }[];
}

export interface CheckoutSessionResponse {
  checkoutSessionId: string;
  checkoutUrl: string;
}
