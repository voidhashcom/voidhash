import {
  CustomerOrigin,
  CustomerType,
  type Customer as DbCustomer,
} from "@voidhash/db";
import { Db, TransactionContext } from "@voidhash/db/effect";
import {
  AuthSession,
  AuthenticationError,
  SdkCustomerAlreadyIdentifiedError,
  SdkServiceError,
} from "@voidhash/shared";
import { Effect } from "effect";

import { CustomerService } from "../customers";
import { _getCustomerByAppUserId, _getCustomerById } from "./utils";

export const identifyCustomer = Effect.gen(function* identifyCustomer() {
  const db = yield* Db;
  const customerService = yield* CustomerService;
  return Effect.fn("identifyCustomer")(
    function* identifyCustomer(input: {
      appUserId: string;
      name: string | null;
      email: string | null;
    }) {
      const session = yield* AuthSession;

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
            const currentAppUserId = session?.customer?.appUserId;

            // Get current customer if exists
            let currentCustomer: DbCustomer | undefined;
            if (currentAppUserId) {
              currentCustomer = yield* _getCustomerByAppUserId(db)({
                appUserId: currentAppUserId,
                projectId,
              });
            }

            // Can't identify already identified anonymous customer.
            if (
              currentCustomer &&
              currentCustomer.type === CustomerType.Anonymous &&
              currentCustomer.parentCustomerId
            ) {
              const parentCustomer = yield* _getCustomerById(db)(
                currentCustomer.parentCustomerId
              );
              if (!parentCustomer) {
                return yield* Effect.die(
                  new Error(
                    "parentCustomer is null event though it should exist"
                  )
                );
              }

              if (parentCustomer.appUserId !== input.appUserId) {
                return yield* Effect.fail(
                  new SdkCustomerAlreadyIdentifiedError({
                    appUserId: input.appUserId,
                  })
                );
              }

              return parentCustomer;
            }

            // Get identifying as customer if exists
            let identifyingAsCustomer = yield* _getCustomerByAppUserId(db)({
              appUserId: input.appUserId,
              projectId,
            });

            // If identifying as customer doesn't exist, create a new one
            if (!identifyingAsCustomer) {
              yield* customerService.createCustomer({
                appUserId: input.appUserId,
                email: input.email ?? null,
                name: input.name ?? null,
                origin: CustomerOrigin.IOS,
                projectId, // TODO: Make this dynamic
              });

              identifyingAsCustomer = yield* _getCustomerByAppUserId(db)({
                appUserId: input.appUserId,
                projectId,
              });

              if (!identifyingAsCustomer) {
                return yield* Effect.dieMessage(
                  "identifyingAsCustomer is null event though it should exist"
                );
              }
            }

            // Merge customers if current customer is anonymous
            if (
              currentCustomer &&
              currentCustomer.type === CustomerType.Anonymous
            ) {
              yield* customerService.mergeCustomers(
                currentCustomer.id,
                identifyingAsCustomer.id
              );
            }

            // Get updated identified customer
            const updatedCustomer = yield* _getCustomerByAppUserId(db)({
              appUserId: input.appUserId,
              projectId,
            });

            if (!updatedCustomer) {
              return yield* Effect.dieMessage(
                "updatedCustomer is null event though it should exist"
              );
            }

            return updatedCustomer;
          })
        )
      );

      yield* Effect.log(
        `Identified customer ${result.id} for app user ${input.appUserId}`
      );

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
          CustomerServiceError: (error) =>
            new SdkServiceError({
              cause: String(error.cause),
            }),
          DatabaseError: (error) =>
            new SdkServiceError({
              cause: String(error.cause),
            }),
        })
      )
  );
});
