import { Effect } from "effect";

import { CustomerService } from "../customers";
import { getCustomer } from "./get-customer";
import { identifyCustomer } from "./identify-customer";
import { syncCustomerAttributes } from "./sync-customer-attributes";

export class SdkService extends Effect.Service<SdkService>()("SdkService", {
  dependencies: [CustomerService.Default],
  effect: Effect.gen(function* effect() {
    return {
      getCustomer: yield* getCustomer,
      identifyCustomer: yield* identifyCustomer,
      syncCustomerAttributes: yield* syncCustomerAttributes,
    } as const;
  }),
}) {}
