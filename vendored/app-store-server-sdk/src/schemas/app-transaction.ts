import { Schema } from "effect";
import { EnvironmentSchema, PurchasePlatformSchema } from "./enums.ts";

/**
 * Decoded payload of a signed App Transaction.
 * @see https://developer.apple.com/documentation/storekit/apptransaction
 */
export const AppTransactionSchema = Schema.Struct({
  /** The environment in which the transaction was generated. */
  receiptType: Schema.OptionFromOptionalKey(Schema.Union([EnvironmentSchema, Schema.String])),

  /** The unique identifier the App Store uses to identify the app. */
  appAppleId: Schema.OptionFromOptionalKey(Schema.Number),

  /** The bundle identifier of the app. */
  bundleId: Schema.OptionFromOptionalKey(Schema.String),

  /** The version of the app. */
  applicationVersion: Schema.OptionFromOptionalKey(Schema.String),

  /** The version external identifier of the app. */
  versionExternalIdentifier: Schema.OptionFromOptionalKey(Schema.Number),

  /** The date that the App Store signed the JWS app transaction (Unix timestamp in ms). */
  receiptCreationDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The date the customer originally purchased the app from the App Store. */
  originalPurchaseDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The version of the app the user originally purchased. */
  originalApplicationVersion: Schema.OptionFromOptionalKey(Schema.String),

  /** Base64 device verification value. */
  deviceVerification: Schema.OptionFromOptionalKey(Schema.String),

  /** UUID used to compute the device verification value. */
  deviceVerificationNonce: Schema.OptionFromOptionalKey(Schema.String),

  /** The date the customer placed an order for the app pre-release. */
  preorderDate: Schema.OptionFromOptionalKey(Schema.Number),

  /** The unique identifier of the app download transaction. */
  appTransactionId: Schema.OptionFromOptionalKey(Schema.String),

  /** Platform on which the customer originally purchased the app. */
  originalPlatform: Schema.OptionFromOptionalKey(
    Schema.Union([PurchasePlatformSchema, Schema.String]),
  ),
});

export type AppTransaction = Schema.Schema.Type<typeof AppTransactionSchema>;

/**
 * Decode an AppTransaction payload from an unknown value.
 */
export const decodeAppTransaction = Schema.decodeUnknownEffect(AppTransactionSchema);
