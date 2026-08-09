import { describe, expect, it } from "vitest";
import { Cause, Effect, Schema } from "effect";
import { AppStoreServerSdkClient } from "../src/client/index.ts";
import { Environment, Status, GetTransactionHistoryVersion } from "../src/schemas/index.ts";
import {
  createMockSdk,
  createMockHttpClient,
  getClientWithMockedResponse,
  getClientWithBody,
  TEST_SIGNING_KEY,
  unwrapOptionsDeep,
} from "./util.ts";

/**
 * Decodes the JSON request bodies captured by the mock HTTP client. Each helper
 * keeps only the fields the corresponding test asserts on; decoding ignores any
 * additional keys the client sends.
 */
const decodeBody = <S extends Schema.Struct<Schema.Struct.Fields>>(schema: S) =>
  Schema.decodeUnknownSync(Schema.fromJsonString(schema));

const decodeExtendRenewalDateBody = decodeBody(
  Schema.Struct({
    extendByDays: Schema.Number,
    extendReasonCode: Schema.Number,
    requestIdentifier: Schema.String,
    storefrontCountryCodes: Schema.optional(Schema.Array(Schema.String)),
    productId: Schema.optional(Schema.String),
  }),
);

const decodeNotificationHistoryBody = decodeBody(
  Schema.Struct({
    startDate: Schema.Number,
    endDate: Schema.Number,
  }),
);

const decodeConsumptionInformationBody = decodeBody(
  Schema.Struct({
    customerConsented: Schema.Boolean,
    consumptionPercentage: Schema.optional(Schema.Number),
    deliveryStatus: Schema.String,
    refundPreference: Schema.optional(Schema.String),
    sampleContentProvided: Schema.Boolean,
  }),
);

const decodeConsumptionDataBody = decodeBody(
  Schema.Struct({
    customerConsented: Schema.Boolean,
    consumptionStatus: Schema.Number,
    platform: Schema.Number,
    sampleContentProvided: Schema.Boolean,
    deliveryStatus: Schema.Number,
    appAccountToken: Schema.String,
    accountTenure: Schema.Number,
    playTime: Schema.Number,
    lifetimeDollarsRefunded: Schema.Number,
    lifetimeDollarsPurchased: Schema.Number,
    userStatus: Schema.Number,
    refundPreference: Schema.Number,
  }),
);

const decodeAppAccountTokenBody = decodeBody(
  Schema.Struct({
    appAccountToken: Schema.String,
  }),
);

const decodeMessageBody = decodeBody(
  Schema.Struct({
    header: Schema.String,
    body: Schema.String,
    headerPosition: Schema.optional(Schema.String),
    image: Schema.optional(
      Schema.Struct({
        imageIdentifier: Schema.String,
        altText: Schema.String,
      }),
    ),
    bulletPoints: Schema.optional(
      Schema.Array(
        Schema.Struct({
          text: Schema.String,
          imageIdentifier: Schema.String,
          altText: Schema.String,
        }),
      ),
    ),
  }),
);

const decodeDefaultMessageBody = decodeBody(
  Schema.Struct({
    messageIdentifier: Schema.String,
  }),
);

const decodeRealtimeUrlBody = decodeBody(
  Schema.Struct({
    realtimeURL: Schema.String,
  }),
);

const decodePerformanceTestBody = decodeBody(
  Schema.Struct({
    originalTransactionId: Schema.String,
  }),
);

/**
 * Shape shared by every `AppStore*Error` after `unwrapOptionsDeep` has flattened
 * its `Option` fields — used to read error details without an `as` assertion.
 */
const decodeApiError = Schema.decodeUnknownSync(
  Schema.Struct({
    _tag: Schema.String,
    httpStatusCode: Schema.Number,
    apiError: Schema.optional(Schema.Number),
    errorMessage: Schema.optional(Schema.String),
  }),
);

describe("The API client", () => {
  it("calls getTransactionInfo", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/transactionInfoResponse.json",
          200,
          (path, method) => {
            expect(method).toBe("GET");
            expect(path).toBe("/inApps/v1/transactions/1234");
          },
        );

        const result = unwrapOptionsDeep(yield* client.getTransactionInfo("1234"));
        expect(result).toBeTruthy();
        expect(result.signedTransactionInfo).toBe("signed_transaction_info_value");
      }),
    ));

  it("calls getTransactionHistory V1", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/transactionHistoryResponse.json",
          200,
          (path, method) => {
            expect(method).toBe("GET");
            expect(path).toContain("/inApps/v1/history/1234");
            expect(path).toContain("revision=revision_input");
            expect(path).toContain("startDate=123455");
            expect(path).toContain("endDate=123456");
          },
        );

        const result = unwrapOptionsDeep(
          yield* client.getTransactionHistory(
            "1234",
            "revision_input",
            {
              startDate: 123455,
              endDate: 123456,
              productIds: ["com.example.1", "com.example.2"],
              productTypes: ["CONSUMABLE", "AUTO_RENEWABLE"],
              sort: "ASCENDING",
              subscriptionGroupIdentifiers: ["sub_group_id", "sub_group_id_2"],
              inAppOwnershipType: "FAMILY_SHARED",
              revoked: false,
            },
            GetTransactionHistoryVersion.V1,
          ),
        );
        expect(result).toBeTruthy();
        expect(result.revision).toBe("revision_output");
        expect(result.hasMore).toBe(true);
        expect(result.bundleId).toBe("com.example");
        expect(result.appAppleId).toBe(323232);
        expect(result.environment).toBe(Environment.LOCAL_TESTING);
        expect(result.signedTransactions).toEqual([
          "signed_transaction_value",
          "signed_transaction_value2",
        ]);
      }),
    ));

  it("calls getTransactionHistory V2", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/transactionHistoryResponse.json",
          200,
          (path, method) => {
            expect(method).toBe("GET");
            expect(path).toContain("/inApps/v2/history/1234");
          },
        );

        const result = unwrapOptionsDeep(
          yield* client.getTransactionHistory(
            "1234",
            "revision_input",
            {
              startDate: 123455,
              endDate: 123456,
              productIds: ["com.example.1"],
              sort: "ASCENDING",
            },
            GetTransactionHistoryVersion.V2,
          ),
        );
        expect(result).toBeTruthy();
        expect(result.revision).toBe("revision_output");
      }),
    ));

  it("calls getAllSubscriptionStatuses", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/getAllSubscriptionStatusesResponse.json",
          200,
          (path, method) => {
            expect(method).toBe("GET");
            expect(path).toContain("/inApps/v1/subscriptions/4321");
            expect(path).toContain("status=2");
            expect(path).toContain("status=1");
          },
        );

        const result = unwrapOptionsDeep(
          yield* client.getAllSubscriptionStatuses("4321", [Status.EXPIRED, Status.ACTIVE]),
        );
        expect(result).toBeTruthy();
        expect(result.environment).toBe(Environment.LOCAL_TESTING);
        expect(result.bundleId).toBe("com.example");
        expect(result.appAppleId).toBe(5454545);
        expect(result.data).toHaveLength(2);
        expect(result.data?.[0]?.subscriptionGroupIdentifier).toBe("sub_group_one");
      }),
    ));

  it("calls getRefundHistory", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/getRefundHistoryResponse.json",
          200,
          (path, method) => {
            expect(method).toBe("GET");
            expect(path).toContain("/inApps/v2/refund/lookup/555555");
            expect(path).toContain("revision=revision_input");
          },
        );

        const result = unwrapOptionsDeep(
          yield* client.getRefundHistory("555555", "revision_input"),
        );
        expect(result).toBeTruthy();
        expect(result.signedTransactions).toEqual(["signed_transaction_one", "signed_transaction_two"]);
        expect(result.revision).toBe("revision_output");
        expect(result.hasMore).toBe(true);
      }),
    ));

  it("calls lookUpOrderId", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/lookupOrderIdResponse.json",
          200,
          (path, method) => {
            expect(method).toBe("GET");
            expect(path).toBe("/inApps/v1/lookup/W002182");
          },
        );

        const result = unwrapOptionsDeep(yield* client.lookUpOrderId("W002182"));
        expect(result).toBeTruthy();
        expect(result.status).toBe(1);
        expect(result.signedTransactions).toEqual(["signed_transaction_one", "signed_transaction_two"]);
      }),
    ));

  it("calls extendSubscriptionRenewalDate", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/extendSubscriptionRenewalDateResponse.json",
          200,
          (path, method, body) => {
            expect(method).toBe("PUT");
            expect(path).toBe("/inApps/v1/subscriptions/extend/4124214");
            expect(body).toBeTruthy();
            const parsed = decodeExtendRenewalDateBody(body!);
            expect(parsed.extendByDays).toBe(45);
            expect(parsed.extendReasonCode).toBe(1);
            expect(parsed.requestIdentifier).toBe("fdf964a4-233b-486c-aac1-97d8d52688ac");
          },
        );

        const result = unwrapOptionsDeep(
          yield* client.extendSubscriptionRenewalDate("4124214", {
            extendByDays: 45,
            extendReasonCode: 1,
            requestIdentifier: "fdf964a4-233b-486c-aac1-97d8d52688ac",
          }),
        );
        expect(result).toBeTruthy();
        expect(result.originalTransactionId).toBe("2312412");
        expect(result.webOrderLineItemId).toBe("9993");
        expect(result.success).toBe(true);
        expect(result.effectiveDate).toBe(1698148900000);
      }),
    ));

  it("calls extendRenewalDateForAllActiveSubscribers", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/extendRenewalDateForAllActiveSubscribersResponse.json",
          200,
          (path, method, body) => {
            expect(method).toBe("POST");
            expect(path).toBe("/inApps/v1/subscriptions/extend/mass");
            expect(body).toBeTruthy();
            const parsed = decodeExtendRenewalDateBody(body!);
            expect(parsed.extendByDays).toBe(45);
            expect(parsed.extendReasonCode).toBe(1);
            expect(parsed.requestIdentifier).toBe("fdf964a4-233b-486c-aac1-97d8d52688ac");
            expect(parsed.storefrontCountryCodes).toEqual(["USA", "MEX"]);
            expect(parsed.productId).toBe("com.example.productId");
          },
        );

        const result = unwrapOptionsDeep(
          yield* client.extendRenewalDateForAllActiveSubscribers({
            extendByDays: 45,
            extendReasonCode: 1,
            requestIdentifier: "fdf964a4-233b-486c-aac1-97d8d52688ac",
            storefrontCountryCodes: ["USA", "MEX"],
            productId: "com.example.productId",
          }),
        );
        expect(result).toBeTruthy();
        expect(result.requestIdentifier).toBe("758883e8-151b-47b7-abd0-60c4d804c2f5");
      }),
    ));

  it("calls getStatusOfSubscriptionRenewalDateExtensions", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/getStatusOfSubscriptionRenewalDateExtensionsResponse.json",
          200,
          (path, method) => {
            expect(method).toBe("GET");
            expect(path).toBe(
              "/inApps/v1/subscriptions/extend/mass/com.example.product/20fba8a0-2b80-4a7d-a17f-85c1854727f8",
            );
          },
        );

        const result = unwrapOptionsDeep(
          yield* client.getStatusOfSubscriptionRenewalDateExtensions(
            "20fba8a0-2b80-4a7d-a17f-85c1854727f8",
            "com.example.product",
          ),
        );
        expect(result).toBeTruthy();
        expect(result.requestIdentifier).toBe("20fba8a0-2b80-4a7d-a17f-85c1854727f8");
        expect(result.complete).toBe(true);
        expect(result.completeDate).toBe(1698148900000);
        expect(result.succeededCount).toBe(30);
        expect(result.failedCount).toBe(2);
      }),
    ));

  it("calls requestTestNotification", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/requestTestNotificationResponse.json",
          200,
          (path, method) => {
            expect(method).toBe("POST");
            expect(path).toBe("/inApps/v1/notifications/test");
          },
        );

        const result = unwrapOptionsDeep(yield* client.requestTestNotification());
        expect(result).toBeTruthy();
        expect(result.testNotificationToken).toBe("ce3af791-365e-4c60-841b-1674b43c1609");
      }),
    ));

  it("calls getTestNotificationStatus", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/getTestNotificationStatusResponse.json",
          200,
          (path, method) => {
            expect(method).toBe("GET");
            expect(path).toBe("/inApps/v1/notifications/test/8cd2974c-f905-492a-bf9a-b2f47c791d19");
          },
        );

        const result = unwrapOptionsDeep(
          yield* client.getTestNotificationStatus("8cd2974c-f905-492a-bf9a-b2f47c791d19"),
        );
        expect(result).toBeTruthy();
        expect(result.signedPayload).toBe("signed_payload");
        expect(result.sendAttempts).toHaveLength(2);
      }),
    ));

  it("calls getNotificationHistory", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/getNotificationHistoryResponse.json",
          200,
          (path, method, body) => {
            expect(method).toBe("POST");
            expect(path).toContain("/inApps/v1/notifications/history");
            expect(path).toContain("paginationToken=a036bc0e-52b8-4bee-82fc-8c24cb6715d6");
            expect(body).toBeTruthy();
            const parsed = decodeNotificationHistoryBody(body!);
            expect(parsed.startDate).toBe(1698148900000);
            expect(parsed.endDate).toBe(1698148950000);
          },
        );

        const result = unwrapOptionsDeep(
          yield* client.getNotificationHistory("a036bc0e-52b8-4bee-82fc-8c24cb6715d6", {
            startDate: 1698148900000,
            endDate: 1698148950000,
          }),
        );
        expect(result).toBeTruthy();
        expect(result.paginationToken).toBe("57715481-805a-4283-8499-1c19b5d6b20a");
        expect(result.hasMore).toBe(true);
        expect(result.notificationHistory).toHaveLength(2);
      }),
    ));

  it("calls sendConsumptionInformation with all fields", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method, body) => {
          expect(method).toBe("PUT");
          expect(path).toBe("/inApps/v2/transactions/consumption/49571273");
          expect(body).toBeTruthy();
          const parsed = decodeConsumptionInformationBody(body!);
          expect(parsed.customerConsented).toBe(true);
          expect(parsed.consumptionPercentage).toBe(50000);
          expect(parsed.deliveryStatus).toBe("DELIVERED");
          expect(parsed.refundPreference).toBe("GRANT_FULL");
          expect(parsed.sampleContentProvided).toBe(false);
        });

        yield* client.sendConsumptionInformation("49571273", {
          customerConsented: true,
          consumptionPercentage: 50000,
          deliveryStatus: "DELIVERED",
          refundPreference: "GRANT_FULL",
          sampleContentProvided: false,
        });
      }),
    ));

  it("calls sendConsumptionInformation with only required fields", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method, body) => {
          expect(method).toBe("PUT");
          expect(path).toBe("/inApps/v2/transactions/consumption/49571273");
          expect(body).toBeTruthy();
          const parsed = decodeConsumptionInformationBody(body!);
          expect(parsed.customerConsented).toBe(true);
          expect(parsed.deliveryStatus).toBe("UNDELIVERED_QUALITY_ISSUE");
          expect(parsed.sampleContentProvided).toBe(true);
          expect(parsed.consumptionPercentage).toBeUndefined();
          expect(parsed.refundPreference).toBeUndefined();
        });

        yield* client.sendConsumptionInformation("49571273", {
          customerConsented: true,
          deliveryStatus: "UNDELIVERED_QUALITY_ISSUE",
          sampleContentProvided: true,
        });
      }),
    ));

  it("calls setAppAccountToken", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method, body) => {
          expect(method).toBe("PUT");
          expect(path).toBe("/inApps/v1/transactions/49571273/appAccountToken");
          expect(body).toBeTruthy();
          const parsed = decodeAppAccountTokenBody(body!);
          expect(parsed.appAccountToken).toBe("7389a31a-fb6d-4569-a2a6-db7d85d84813");
        });

        yield* client.setAppAccountToken("49571273", {
          appAccountToken: "7389a31a-fb6d-4569-a2a6-db7d85d84813",
        });
      }),
    ));

  it("calls getAppTransactionInfo", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/appTransactionInfoResponse.json",
          200,
          (path, method) => {
            expect(method).toBe("GET");
            expect(path).toBe("/inApps/v1/transactions/appTransactions/1234");
          },
        );

        const result = unwrapOptionsDeep(yield* client.getAppTransactionInfo("1234"));
        expect(result).toBeTruthy();
        expect(result.signedAppTransactionInfo).toBe("signed_app_transaction_info_value");
      }),
    ));

  it("calls uploadImage", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method) => {
          expect(method).toBe("PUT");
          expect(path).toBe("/inApps/v1/messaging/image/a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890");
        });

        yield* client.uploadImage("a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890", new Uint8Array([1, 2, 3]));
      }),
    ));

  it("calls deleteImage", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method) => {
          expect(method).toBe("DELETE");
          expect(path).toBe("/inApps/v1/messaging/image/a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890");
        });

        yield* client.deleteImage("a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890");
      }),
    ));

  it("calls getImageList", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/getImageListResponse.json",
          200,
          (path, method) => {
            expect(method).toBe("GET");
            expect(path).toBe("/inApps/v1/messaging/image/list");
          },
        );

        const result = unwrapOptionsDeep(yield* client.getImageList());
        expect(result).toBeTruthy();
        expect(result.imageIdentifiers).toHaveLength(1);
        expect(result.imageIdentifiers?.[0]?.imageIdentifier).toBe(
          "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890",
        );
        expect(result.imageIdentifiers?.[0]?.imageState).toBe("APPROVED");
        expect(result.imageIdentifiers?.[0]?.imageSize).toBe("FULL_SIZE");
      }),
    ));

  it("calls uploadMessage", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method, body) => {
          expect(method).toBe("PUT");
          expect(path).toBe("/inApps/v1/messaging/message/a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890");
          const parsed = decodeMessageBody(body!);
          expect(parsed.header).toBe("Header text");
          expect(parsed.body).toBe("Body text");
          expect(parsed.image).toBeUndefined();
        });

        yield* client.uploadMessage("a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890", {
          header: "Header text",
          body: "Body text",
        });
      }),
    ));

  it("calls uploadMessage with image", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method, body) => {
          expect(method).toBe("PUT");
          expect(path).toBe("/inApps/v1/messaging/message/a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890");
          const parsed = decodeMessageBody(body!);
          expect(parsed.header).toBe("Header text");
          expect(parsed.body).toBe("Body text");
          expect(parsed.image?.imageIdentifier).toBe("b2c3d4e5-f6a7-8901-b2c3-d4e5f6a78901");
          expect(parsed.image?.altText).toBe("Alt text");
        });

        yield* client.uploadMessage("a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890", {
          header: "Header text",
          body: "Body text",
          image: {
            imageIdentifier: "b2c3d4e5-f6a7-8901-b2c3-d4e5f6a78901",
            altText: "Alt text",
          },
        });
      }),
    ));

  it("calls deleteMessage", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method) => {
          expect(method).toBe("DELETE");
          expect(path).toBe("/inApps/v1/messaging/message/a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890");
        });

        yield* client.deleteMessage("a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890");
      }),
    ));

  it("calls getMessageList", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/getMessageListResponse.json",
          200,
          (path, method) => {
            expect(method).toBe("GET");
            expect(path).toBe("/inApps/v1/messaging/message/list");
          },
        );

        const result = unwrapOptionsDeep(yield* client.getMessageList());
        expect(result).toBeTruthy();
        expect(result.messageIdentifiers).toHaveLength(1);
        expect(result.messageIdentifiers?.[0]?.messageIdentifier).toBe(
          "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890",
        );
        expect(result.messageIdentifiers?.[0]?.messageState).toBe("APPROVED");
      }),
    ));

  it("calls configureDefaultMessage", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method, body) => {
          expect(method).toBe("PUT");
          expect(path).toBe("/inApps/v1/messaging/default/com.example.product/en-US");
          const parsed = decodeDefaultMessageBody(body!);
          expect(parsed.messageIdentifier).toBe("a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890");
        });

        yield* client.configureDefaultMessage("com.example.product", "en-US", {
          messageIdentifier: "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890",
        });
      }),
    ));

  it("calls deleteDefaultMessage", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method) => {
          expect(method).toBe("DELETE");
          expect(path).toBe("/inApps/v1/messaging/default/com.example.product/en-US");
        });

        yield* client.deleteDefaultMessage("com.example.product", "en-US");
      }),
    ));

  // Error handling tests
  it("handles general internal error", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse("tests/resources/models/apiException.json", 500);

        const result = yield* Effect.exit(client.getTransactionInfo("1234"));
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          {
            const apiError = decodeApiError(unwrapOptionsDeep(Cause.squash(result.cause)));
            expect(apiError._tag).toBe("AppStoreInternalError");
            expect(apiError.httpStatusCode).toBe(500);
            expect(apiError.apiError).toBe(5000000);
            expect(apiError.errorMessage).toBe("An unknown error occurred.");
          }
        }
      }),
    ));

  it("handles rate limit exceeded error", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/apiTooManyRequestsException.json",
          429,
        );

        const result = yield* Effect.exit(client.getTransactionInfo("1234"));
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          {
            const apiError = decodeApiError(unwrapOptionsDeep(Cause.squash(result.cause)));
            expect(apiError._tag).toBe("AppStoreRateLimitError");
            expect(apiError.httpStatusCode).toBe(429);
          }
        }
      }),
    ));

  it("handles unknown error code", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse("tests/resources/models/apiUnknownError.json", 400);

        const result = yield* Effect.exit(client.getTransactionInfo("1234"));
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          {
            const apiError = decodeApiError(unwrapOptionsDeep(Cause.squash(result.cause)));
            expect(apiError._tag).toBe("AppStoreValidationError");
            expect(apiError.httpStatusCode).toBe(400);
            expect(apiError.apiError).toBe(9990000);
            expect(apiError.errorMessage).toBe("Testing error.");
          }
        }
      }),
    ));

  it("accepts unknown environment strings in transaction history responses", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/transactionHistoryResponseWithMalformedEnvironment.json",
          200,
        );

        const result = unwrapOptionsDeep(
          yield* client.getTransactionHistory(
            "1234",
            "revision_input",
            {
              productTypes: ["CONSUMABLE", "AUTO_RENEWABLE"],
              endDate: 123456,
              startDate: 123455,
              revoked: false,
              inAppOwnershipType: "FAMILY_SHARED",
              productIds: ["com.example.1", "com.example.2"],
              subscriptionGroupIdentifiers: ["sub_group_id", "sub_group_id_2"],
              sort: "ASCENDING",
            },
            GetTransactionHistoryVersion.V2,
          ),
        );
        expect(result.environment).toBe("LocalTestingxxx");
      }),
    ));

  it("rejects malformed appAppleId in transaction history responses", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/transactionHistoryResponseWithMalformedAppAppleId.json",
          200,
        );

        const result = yield* Effect.exit(
          client.getTransactionHistory(
            "1234",
            "revision_input",
            {
              productTypes: ["CONSUMABLE", "AUTO_RENEWABLE"],
              endDate: 123456,
              startDate: 123455,
              revoked: false,
              inAppOwnershipType: "FAMILY_SHARED",
              productIds: ["com.example.1", "com.example.2"],
              subscriptionGroupIdentifiers: ["sub_group_id", "sub_group_id_2"],
              sort: "ASCENDING",
            },
            GetTransactionHistoryVersion.V2,
          ),
        );
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          const apiError = decodeApiError(unwrapOptionsDeep(Cause.squash(result.cause)));
          expect(apiError._tag).toBe("AppStoreSchemaError");
          expect(apiError.httpStatusCode).toBe(200);
        }
      }),
    ));

  it("handles invalid app account token UUID error", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/invalidAppAccountTokenUUIDError.json",
          400,
        );

        const result = yield* Effect.exit(
          client.setAppAccountToken("49571273", {
            appAccountToken: "abc",
          }),
        );
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          {
            const apiError = decodeApiError(unwrapOptionsDeep(Cause.squash(result.cause)));
            expect(apiError._tag).toBe("AppStoreValidationError");
            expect(apiError.httpStatusCode).toBe(400);
            expect(apiError.apiError).toBe(4000183);
          }
        }
      }),
    ));

  it("handles family transaction not supported error", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/familyTransactionNotSupportedError.json",
          400,
        );

        const result = yield* Effect.exit(
          client.setAppAccountToken("1234", {
            appAccountToken: "7389a31a-fb6d-4569-a2a6-db7d85d84813",
          }),
        );
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          {
            const apiError = decodeApiError(unwrapOptionsDeep(Cause.squash(result.cause)));
            expect(apiError._tag).toBe("AppStoreValidationError");
            expect(apiError.httpStatusCode).toBe(400);
            expect(apiError.apiError).toBe(4000185);
          }
        }
      }),
    ));

  it("handles transaction id not original transaction id error", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/transactionIdNotOriginalTransactionId.json",
          400,
        );

        const result = yield* Effect.exit(
          client.setAppAccountToken("1234", {
            appAccountToken: "7389a31a-fb6d-4569-a2a6-db7d85d84813",
          }),
        );
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          {
            const apiError = decodeApiError(unwrapOptionsDeep(Cause.squash(result.cause)));
            expect(apiError._tag).toBe("AppStoreValidationError");
            expect(apiError.httpStatusCode).toBe(400);
            expect(apiError.apiError).toBe(4000187);
          }
        }
      }),
    ));

  it("handles invalid transaction id error for getAppTransactionInfo", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/invalidTransactionIdError.json",
          400,
        );

        const result = yield* Effect.exit(client.getAppTransactionInfo("invalid_id"));
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          {
            const apiError = decodeApiError(unwrapOptionsDeep(Cause.squash(result.cause)));
            expect(apiError._tag).toBe("AppStoreValidationError");
          }
        }
      }),
    ));

  it("handles app transaction does not exist error", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/appTransactionDoesNotExistError.json",
          404,
        );

        const result = yield* Effect.exit(client.getAppTransactionInfo("5678"));
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          {
            const apiError = decodeApiError(unwrapOptionsDeep(Cause.squash(result.cause)));
            expect(apiError._tag).toBe("AppStoreNotFoundError");
          }
        }
      }),
    ));

  it("handles transaction id not found error", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/transactionIdNotFoundError.json",
          404,
        );

        const result = yield* Effect.exit(client.getAppTransactionInfo("9999"));
        expect(result._tag).toBe("Failure");
        if (result._tag === "Failure") {
          {
            const apiError = decodeApiError(unwrapOptionsDeep(Cause.squash(result.cause)));
            expect(apiError._tag).toBe("AppStoreNotFoundError");
          }
        }
      }),
    ));

  it("calls sendConsumptionData (V1)", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method, body) => {
          expect(method).toBe("PUT");
          expect(path).toBe("/inApps/v1/transactions/consumption/49571273");
          const parsed = decodeConsumptionDataBody(body!);
          expect(parsed.customerConsented).toBe(true);
          expect(parsed.consumptionStatus).toBe(1);
          expect(parsed.platform).toBe(2);
          expect(parsed.sampleContentProvided).toBe(false);
          expect(parsed.deliveryStatus).toBe(3);
          expect(parsed.appAccountToken).toBe("7389a31a-fb6d-4569-a2a6-db7d85d84813");
          expect(parsed.accountTenure).toBe(4);
          expect(parsed.playTime).toBe(5);
          expect(parsed.lifetimeDollarsRefunded).toBe(6);
          expect(parsed.lifetimeDollarsPurchased).toBe(7);
          expect(parsed.userStatus).toBe(4);
          expect(parsed.refundPreference).toBe(3);
        });

        yield* client.sendConsumptionData("49571273", {
          customerConsented: true,
          consumptionStatus: 1,
          platform: 2,
          sampleContentProvided: false,
          deliveryStatus: 3,
          appAccountToken: "7389a31a-fb6d-4569-a2a6-db7d85d84813",
          accountTenure: 4,
          playTime: 5,
          lifetimeDollarsRefunded: 6,
          lifetimeDollarsPurchased: 7,
          userStatus: 4,
          refundPreference: 3,
        });
      }),
    ));

  it("calls finishTransaction", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method, body) => {
          expect(method).toBe("POST");
          expect(path).toBe("/inApps/v1/transactions/1234/finish");
          expect(body).toBeUndefined();
        });

        yield* client.finishTransaction("1234");
      }),
    ));

  it("calls uploadImage with imageSize", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method) => {
          expect(method).toBe("PUT");
          expect(path).toContain("/inApps/v1/messaging/image/a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890");
          expect(path).toContain("imageSize=FULL_SIZE");
        });

        yield* client.uploadImage(
          "a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890",
          new Uint8Array([1, 2, 3]),
          "FULL_SIZE",
        );
      }),
    ));

  it("calls getDefaultMessage", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/getDefaultMessageResponse.json",
          200,
          (path, method) => {
            expect(method).toBe("GET");
            expect(path).toBe("/inApps/v1/messaging/default/com.example.product/en-US");
          },
        );

        const result = unwrapOptionsDeep(
          yield* client.getDefaultMessage("com.example.product", "en-US"),
        );
        expect(result.messageIdentifier).toBe("a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890");
      }),
    ));

  it("calls configureRealtimeURL", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method, body) => {
          expect(method).toBe("PUT");
          expect(path).toBe("/inApps/v1/messaging/realtime/url");
          const parsed = decodeRealtimeUrlBody(body!);
          expect(parsed.realtimeURL).toBe("https://example.com/realtime");
        });

        yield* client.configureRealtimeURL({ realtimeURL: "https://example.com/realtime" });
      }),
    ));

  it("calls deleteRealtimeURL", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method) => {
          expect(method).toBe("DELETE");
          expect(path).toBe("/inApps/v1/messaging/realtime/url");
        });

        yield* client.deleteRealtimeURL();
      }),
    ));

  it("calls getRealtimeURL", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/getRealtimeUrlResponse.json",
          200,
          (path, method) => {
            expect(method).toBe("GET");
            expect(path).toBe("/inApps/v1/messaging/realtime/url");
          },
        );

        const result = unwrapOptionsDeep(yield* client.getRealtimeURL());
        expect(result.realtimeURL).toBe("https://example.com/realtime");
      }),
    ));

  it("calls initiatePerformanceTest", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/performanceTestResponse.json",
          200,
          (path, method, body) => {
            expect(method).toBe("POST");
            expect(path).toBe("/inApps/v1/messaging/performanceTest");
            const parsed = decodePerformanceTestBody(body!);
            expect(parsed.originalTransactionId).toBe("70000500092808");
          },
        );

        const result = unwrapOptionsDeep(
          yield* client.initiatePerformanceTest({ originalTransactionId: "70000500092808" }),
        );
        expect(result.requestId).toBe("c4b87a1d-2e3f-4a5b-9c6d-7e8f9a0b1c2d");
        expect(result.config?.maxConcurrentRequests).toBe(10);
        expect(result.config?.totalRequests).toBe(100);
        expect(result.config?.totalDuration).toBe(60000);
        expect(result.config?.responseTimeThreshold).toBe(500);
        expect(result.config?.successRateThreshold).toBe(95);
      }),
    ));

  it("calls getPerformanceTestResults", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithMockedResponse(
          "tests/resources/models/performanceTestResultResponse.json",
          200,
          (path, method) => {
            expect(method).toBe("GET");
            expect(path).toBe(
              "/inApps/v1/messaging/performanceTest/result/c4b87a1d-2e3f-4a5b-9c6d-7e8f9a0b1c2d",
            );
          },
        );

        const result = unwrapOptionsDeep(
          yield* client.getPerformanceTestResults("c4b87a1d-2e3f-4a5b-9c6d-7e8f9a0b1c2d"),
        );
        expect(result.config?.maxConcurrentRequests).toBe(10);
        expect(result.target).toBe("https://example.com/retention");
        expect(result.result).toBe("PASS");
        expect(result.successRate).toBe(98);
        expect(result.numPending).toBe(0);
        expect(result.responseTimes?.average).toBe(120);
        expect(result.responseTimes?.p50).toBe(100);
        expect(result.responseTimes?.p90).toBe(200);
        expect(result.responseTimes?.p95).toBe(250);
        expect(result.responseTimes?.p99).toBe(400);
        expect(result.failures?.TIMED_OUT).toBe(1);
        expect(result.failures?.NO_RESPONSE).toBe(1);
      }),
    ));

  it("calls uploadMessage with image and bullet points", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const client = getClientWithBody("", 200, (path, method, body) => {
          expect(method).toBe("PUT");
          expect(path).toBe("/inApps/v1/messaging/message/a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890");
          const parsed = decodeMessageBody(body!);
          expect(parsed.header).toBe("Header text");
          expect(parsed.body).toBe("Body text");
          expect(parsed.headerPosition).toBe("ABOVE_IMAGE");
          expect(parsed.image?.imageIdentifier).toBe("b2c3d4e5-f6a7-8901-b2c3-d4e5f6a78901");
          expect(parsed.image?.altText).toBe("Alt text");
          expect(parsed.bulletPoints).toHaveLength(1);
          expect(parsed.bulletPoints?.[0]?.text).toBe("Bullet text");
          expect(parsed.bulletPoints?.[0]?.imageIdentifier).toBe("c3d4e5f6-a7b8-9012-c3d4-e5f6a7b89012");
          expect(parsed.bulletPoints?.[0]?.altText).toBe("Bullet alt text");
        });

        yield* client.uploadMessage("a1b2c3d4-e5f6-7890-a1b2-c3d4e5f67890", {
          header: "Header text",
          body: "Body text",
          headerPosition: "ABOVE_IMAGE",
          image: {
            imageIdentifier: "b2c3d4e5-f6a7-8901-b2c3-d4e5f6a78901",
            altText: "Alt text",
          },
          bulletPoints: [
            {
              text: "Bullet text",
              imageIdentifier: "c3d4e5f6-a7b8-9012-c3d4-e5f6a7b89012",
              altText: "Bullet alt text",
            },
          ],
        });
      }),
    ));

  it("throws when the XCODE environment is used for the API client", () => {
    const sdk = createMockSdk(createMockHttpClient("", 200));
    expect(() =>
      AppStoreServerSdkClient.make(sdk, {
        signingKey: TEST_SIGNING_KEY,
        keyId: "keyId",
        issuerId: "issuerId",
        bundleId: "bundleId",
        environment: Environment.XCODE,
      }),
    ).toThrow(/Xcode is not a supported environment/);
  });
});
