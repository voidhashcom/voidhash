import { Db, TransactionContext } from "@voidhash/db/effect";
import {
  AuthSession,
  AuthenticationError,
  SdkCustomerNotFoundError,
  SdkServiceError,
  SdkValidationError,
} from "@voidhash/shared";
import { Effect } from "effect";

import { _getCustomerByAppUserId, _getCustomerById } from "./utils";

export const getCustomer = Effect.gen(function* getCustomer() {
  const db = yield* Db;
  return Effect.fn("getCustomer")(
    function* getCustomer() {
      const session = yield* AuthSession;

      const appUserId = session?.customer?.appUserId;
      if (!appUserId) {
        return yield* Effect.fail(
          new SdkValidationError({
            message: "App user ID not found",
          })
        );
      }

      const projectId = session?.projects[0]?.id;
      if (!projectId) {
        return yield* Effect.fail(
          new AuthenticationError({
            cause:
              "No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.",
            message:
              "No projects with granted access found in your authentication session. Make sure you are using compatible authentication method.",
          })
        );
      }

      const result = yield* db.transaction((tx) =>
        TransactionContext.provide(tx)(
          Effect.gen(function* result() {
            // Try to get existing customer
            const customer = yield* _getCustomerByAppUserId(db)({
              appUserId,
              projectId,
            });

            if (customer) {
              // Return parent if it exists, otherwise return the customer itself
              if (customer.parentCustomerId) {
                const parentCustomer = yield* _getCustomerById(db)(
                  customer.parentCustomerId
                );
                return parentCustomer;
              }
              return customer;
            }

            // Customer not found and not anonymous ID
            return yield* Effect.fail(
              new SdkCustomerNotFoundError({
                message: "Customer not found",
              })
            );
          })
        )
      );

      if (!result) {
        return yield* Effect.fail(
          new SdkCustomerNotFoundError({
            message: "Customer not found",
          })
        );
      }

      return {
        appUserId: result.appUserId,
        customerId: result.id,
        email: result.email,
        name: result.name,
      };
    },
    (effect) =>
      effect.pipe(
        Effect.catchTags({
          DatabaseError: (error) =>
            new SdkServiceError({
              cause: String(error.cause),
            }),
        })
      )
  );
});
