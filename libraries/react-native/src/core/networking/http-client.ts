import { err, ok, type Result } from 'neverthrow';
import { SDK_VERSION } from '../constants';
import type { Logger } from '../logging';
import type { PlatformProvider } from '../platform/types';
import type {
  AuthenticationError,
  BundleIdNotFoundError,
  HttpRequestError,
  RateLimitError,
  ResponseError
} from './errors';

type HttpClientOptions = {
  publishableKey: string;
  baseUrl: string;
  platformProvider: PlatformProvider;
  logger: Logger;
};

export class HttpClient {
  private publishableKey: string;
  private platformProvider: PlatformProvider;
  private logger: Logger;
  private baseUrl: string;

  constructor(options: HttpClientOptions) {
    this.publishableKey = options.publishableKey;
    this.platformProvider = options.platformProvider;
    this.logger = options.logger;
    this.baseUrl = options.baseUrl;
  }

  // authenticate(options: { userId: string; publishableKey: string }) {
  //   this.userId = options.userId;
  //   this.publishableKey = options.publishableKey;
  // }

  async fetch<T>(
    url: string | URL,
    appUserId: string,
    init?: RequestInit
  ): Promise<
    Result<
      T,
      | HttpRequestError
      | RateLimitError
      | AuthenticationError
      | ResponseError
      | BundleIdNotFoundError
    >
  > {
    const headers = await this.getHeaders();
    const validationResult = this.validateHeaders(headers);
    if (validationResult.isErr()) {
      return err(validationResult.error);
    }

    const filteredHeaders = Object.fromEntries(
      Object.entries(headers).filter(([_, value]) => value !== undefined)
    );

    // Merge headers, giving precedence to headers in init
    const mergedHeaders = {
      ...filteredHeaders,
      ...(init?.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : (init?.headers as Record<string, string> | undefined)),
      'x-app-user-id': appUserId
    };

    try {
      this.logger.debug(`${init?.method ?? 'GET'} ${url}`, {
        headers: mergedHeaders
      });

      const response = await fetch(this.baseUrl + url, {
        ...init,
        headers: mergedHeaders
      });

      if (!response.ok) {
        this.logger.debug('Fetch failed', {
          url,
          status: response.status,
          statusText: response.statusText
        });

        if (response.status === 429) {
          return err({
            _tag: 'RateLimitError',
            message: 'Rate limit exceeded'
          } satisfies RateLimitError);
        }

        if (response.status === 401) {
          return err({
            _tag: 'AuthenticationError',
            message: 'Unauthorized'
          } satisfies AuthenticationError);
        }

        return err({
          _tag: 'ResponseError',
          message: 'Server error',
          statusCode: response.status,
          response
        } satisfies ResponseError);
      }

      const json = await response.json();

      this.logger.debug('Fetch successful', {
        url,
        status: response.status,
        statusText: response.statusText
      });

      return ok(json as T);
    } catch (error) {
      this.logger.error('Fetch failed', {
        url,
        error:
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Unknown error'
      });

      return err({
        _tag: 'HttpRequestError',
        message:
          error instanceof Error
            ? error.message
            : typeof error === 'string'
              ? error
              : 'Unknown error',
        cause: error
      } satisfies HttpRequestError);
    }
  }

  private validateHeaders(
    headers: Record<string, string>
  ): Result<void, BundleIdNotFoundError> {
    if (headers['X-Client-Bundle-ID'] === '') {
      return err({
        _tag: 'BundleIdNotFoundError',
        message:
          "Bundle ID not found. Specify the 'package' for android or 'bundleIdentifier' for ios in app.json."
      } satisfies BundleIdNotFoundError);
    }

    return ok(undefined);
  }

  private getHeaders() {
    const bundleId = this.platformProvider.getBundleId() ?? '';
    const locales = this.platformProvider.getLocales();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-publishable-key': this.publishableKey,
      'X-Platform': this.platformProvider.getPlatform(),
      'X-SDK': 'react-native',
      'X-SDK-Version': SDK_VERSION,
      'X-Platform-Flavor': 'native',
      'X-Observer-Mode': 'false',
      'X-Platform-Version': this.platformProvider.getSystemVersion(),
      'X-Platform-Device': this.platformProvider.getDeviceName(),
      'X-Platform-Brand': this.platformProvider.getDeviceBrand(),
      'X-Client-Bundle-ID': bundleId,
      'X-Is-Debug-Build': this.platformProvider.isDebugBuild()
        ? 'true'
        : 'false',
      'X-Is-Backgrounded': 'false' // Not supported, default to false
    };

    // Add optional headers only if they have values
    const appVersion = this.platformProvider.getAppVersion();
    if (appVersion) {
      headers['X-Platform-Flavor-Version'] = appVersion;
      headers['X-Client-Version'] = appVersion;
    }

    if (locales.length > 0) {
      headers['X-Preferred-Locales'] = locales
        .map((locale) => locale.languageTag)
        .join(',');
      if (locales[0]?.languageTag) {
        headers['X-Client-Locale'] = locales[0].languageTag;
      }
    }

    return headers;
  }
}
