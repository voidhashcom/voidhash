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

type IdentifyCustomerBody = {
  appUserId: string;
  name?: string;
  email?: string;
};

export const identifyCustomerOperationFactory = (httpClient: HttpClient) => {
  return async (
    body: IdentifyCustomerBody,
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
      '/v1/sdk/identify',
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
