import { Effect } from "effect";

import { createCustomer } from "./create-customer";
import { getCustomerByAppUserId } from "./get-customer-by-app-user-id";
import { getCustomerById } from "./get-customer-by-id";
import { getCustomerPurchases } from "./get-customer-purchases";
import { getCustomers } from "./get-customers";
import { getCustomersUnlockedPerks } from "./get-customers-unlocked-perks";
import { mergeCustomers } from "./merge-customers";

export class CustomerService extends Effect.Service<CustomerService>()(
  "CustomerService",
  {
    dependencies: [],
    effect: Effect.gen(function* effect() {
      return {
        createCustomer: yield* createCustomer,
        getCustomerByAppUserId: yield* getCustomerByAppUserId,
        getCustomerById: yield* getCustomerById,
        getCustomerPurchases: yield* getCustomerPurchases,
        getCustomers: yield* getCustomers,
        getCustomersUnlockedPerks: yield* getCustomersUnlockedPerks,
        mergeCustomers: yield* mergeCustomers,
      } as const;
    }),
  }
) {}
