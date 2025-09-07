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

export const getCustomerOperationFactory = (httpClient: HttpClient) => {
  return async (
    appUserId: string
  ): Promise<
    Result<
      Customer | null,
      | HttpRequestError
      | RateLimitError
      | AuthenticationError
      | ResponseError
      | BundleIdNotFoundError
    >
  > => {
    const responseResult = await httpClient.fetch<Customer>(
      '/v1/sdk/get-customer',
      appUserId,
      {
        method: 'GET'
      }
    );

    if (responseResult.isErr()) {
      if (
        responseResult.error._tag === 'ResponseError' &&
        responseResult.error.statusCode === 404
      ) {
        return ok(null);
      }
      return err(responseResult.error);
    }

    return ok(responseResult.value);
  };
};
