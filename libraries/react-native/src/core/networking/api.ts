import type { HttpClient } from './http-client';
import { getCustomerOperationFactory } from './operations/get-customer';
import { identifyCustomerOperationFactory } from './operations/identify-customer';
import { syncCustomerAttributesOperationFactory } from './operations/sync-customer-attributes';

export function createApi(httpClient: HttpClient) {
  return {
    syncCustomerAttributes: syncCustomerAttributesOperationFactory(httpClient),
    identifyCustomer: identifyCustomerOperationFactory(httpClient),
    getCustomer: getCustomerOperationFactory(httpClient)
  };
}

export type Api = ReturnType<typeof createApi>;
