import { Effect } from 'effect';
import { createCustomer } from './create-customer';
import { getCustomerByAppUserId } from './get-customer-by-app-user-id';
import { getCustomerById } from './get-customer-by-id';
import { getCustomerPurchases } from './get-customer-purchases';
import { getCustomers } from './get-customers';
import { getCustomersUnlockedPerks } from './get-customers-unlocked-perks';
import { mergeCustomers } from './merge-customers';

export class CustomerService extends Effect.Service<CustomerService>()(
  'CustomerService',
  {
    dependencies: [],
    effect: Effect.gen(function* () {
      return {
        createCustomer: yield* createCustomer,
        getCustomers: yield* getCustomers,
        getCustomerById: yield* getCustomerById,
        getCustomerByAppUserId: yield* getCustomerByAppUserId,
        getCustomersUnlockedPerks: yield* getCustomersUnlockedPerks,
        getCustomerPurchases: yield* getCustomerPurchases,
        mergeCustomers: yield* mergeCustomers
      } as const;
    })
  }
) {}

