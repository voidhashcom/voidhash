import { err, ok, type Result } from 'neverthrow';

import type {
  AuthenticationError,
  BundleIdNotFoundError,
  HttpRequestError,
  RateLimitError,
  ResponseError
} from '../errors';
import type { HttpClient } from '../http-client';
import type { Customer } from '../types';

// biome-ignore lint/complexity/noBannedTypes: TODO: Remove TEMP
type SyncCustomerAttributesBody = {};

export const syncCustomerAttributesOperationFactory = (
  httpClient: HttpClient
) => {
  return async (
    body: SyncCustomerAttributesBody,
    currentAppUserId: string
  ): Promise<
    Result<
      Customer,
      | HttpRequestError
      | RateLimitError
      | AuthenticationError
      | ResponseError
      | BundleIdNotFoundError
    >
  > => {
    const responseResult = await httpClient.fetch<Customer>(
      '/v1/sdk/sync-customer-attributes',
      currentAppUserId,
      {
        method: 'POST',
        body: JSON.stringify(body)
      }
    );

    if (responseResult.isErr()) {
      // TODO: Properly handle errors
      return err(responseResult.error);
    }

    return ok(responseResult.value);
  };
};
