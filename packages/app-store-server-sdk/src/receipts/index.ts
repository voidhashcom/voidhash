import { Effect, Option, Schema } from "effect";
import { causeMessage } from "@voidhash/lib/lang";
import { base64ToBytes, bytesToHex, bytesToUtf8, hexToBytes } from "../internal/bytes.ts";

/**
 * Error thrown when receipt parsing fails.
 */
export class ReceiptParseError extends Schema.TaggedErrorClass<ReceiptParseError>(
  "ReceiptParseError",
)("ReceiptParseError", {
  message: Schema.String,
  cause: Schema.OptionFromOptionalKey(Schema.Unknown),
}) {}

// ASN.1 attribute type identifiers used inside Apple App Receipts.
const IN_APP_TYPE_ID = 17;
const TRANSACTION_IDENTIFIER_TYPE_ID = 1703;
const ORIGINAL_TRANSACTION_IDENTIFIER_TYPE_ID = 1705;

interface Asn1Parsed {
  readonly tag: number;
  readonly value: string; // hex
  readonly end: number; // position after the value, in hex chars
}

/**
 * Parses a single ASN.1 DER/BER element from the hex string at `offset`.
 *
 * Supports BER indefinite-length encoding (`0x80`): the contents are scanned
 * recursively for the matching `0x00 0x00` end-of-contents marker, then the
 * returned `end` skips past that marker. Apple's Xcode-generated receipts use
 * indefinite-length encoding at several nesting levels, so this is required.
 */
const parseAsn1 = (hex: string, offset: number): Option.Option<Asn1Parsed> => {
  if (offset + 4 > hex.length) return Option.none();

  const tag = Number.parseInt(hex.slice(offset, offset + 2), 16);
  let cursor = offset + 2;

  const firstLenByte = Number.parseInt(hex.slice(cursor, cursor + 2), 16);
  cursor += 2;

  if (firstLenByte === 0x80) {
    const contentStart = cursor;
    let scan = cursor;
    while (scan + 4 <= hex.length) {
      if (hex.slice(scan, scan + 4) === "0000") {
        return Option.some({ tag, value: hex.slice(contentStart, scan), end: scan + 4 });
      }
      const inner = parseAsn1(hex, scan);
      if (Option.isNone(inner)) return Option.none();
      scan = inner.value.end;
    }
    return Option.none();
  }

  let length: number;
  if (firstLenByte <= 0x7f) {
    length = firstLenByte;
  } else {
    const numOctets = firstLenByte & 0x7f;
    if (cursor + numOctets * 2 > hex.length) return Option.none();
    length = Number.parseInt(hex.slice(cursor, cursor + numOctets * 2), 16);
    cursor += numOctets * 2;
  }

  const valueEnd = cursor + length * 2;
  if (valueEnd > hex.length) return Option.none();
  return Option.some({ tag, value: hex.slice(cursor, valueEnd), end: valueEnd });
};

/**
 * Navigates to the value at a structural path within ASN.1 hex data.
 *
 * The path starts inside the top-level SEQUENCE/SET at `hex`; each element is
 * the zero-based child index to descend into.
 */
const navigateToPath = (hex: string, path: readonly number[]): Option.Option<string> => {
  const outer = parseAsn1(hex, 0);
  if (Option.isNone(outer)) return Option.none();
  let current = outer.value.value;
  for (const targetIndex of path) {
    let offset = 0;
    let count = 0;
    while (count < targetIndex) {
      const parsed = parseAsn1(current, offset);
      if (Option.isNone(parsed)) return Option.none();
      offset = parsed.value.end;
      count++;
    }
    const node = parseAsn1(current, offset);
    if (Option.isNone(node)) return Option.none();
    current = node.value.value;
  }
  return Option.some(current);
};

/**
 * Reads the integer payload of an INTEGER element.
 */
const readInteger = (hex: string): number => Number.parseInt(hex, 16);

/**
 * Reads the UTF-8 string payload of an OCTET STRING wrapping a UTF8String.
 */
const readUtf8FromOctet = (octetValue: string): Option.Option<string> => {
  const inner = parseAsn1(octetValue, 0);
  if (Option.isNone(inner)) return Option.none();
  return Option.some(bytesToUtf8(hexToBytes(inner.value.value)));
};

/**
 * Iterates through a SET-of-SEQUENCE structure looking for the attribute
 * with the given type id. Returns the OCTET STRING value (still hex-encoded).
 */
const findAttribute = (setHex: string, typeId: number): Option.Option<string> => {
  let offset = 0;
  while (offset < setHex.length) {
    const seq = parseAsn1(setHex, offset);
    if (Option.isNone(seq)) break;
    const typeNode = parseAsn1(seq.value.value, 0);
    if (Option.isNone(typeNode)) break;
    if (readInteger(typeNode.value.value) === typeId) {
      // attribute is { type, version, value }
      const versionNode = parseAsn1(seq.value.value, typeNode.value.end);
      if (Option.isNone(versionNode)) return Option.none();
      const valueNode = parseAsn1(seq.value.value, versionNode.value.end);
      if (Option.isNone(valueNode)) return Option.none();
      return Option.some(valueNode.value.value);
    }
    offset = seq.value.end;
  }
  return Option.none();
};

/**
 * Iterates through all attributes of the given type, applying the callback to
 * each value. Returns the first present callback result.
 */
const forEachAttribute = <T>(
  setHex: string,
  typeId: number,
  fn: (valueHex: string) => Option.Option<T>,
): Option.Option<T> => {
  let offset = 0;
  while (offset < setHex.length) {
    const seq = parseAsn1(setHex, offset);
    if (Option.isNone(seq)) break;
    const typeNode = parseAsn1(seq.value.value, 0);
    if (Option.isSome(typeNode) && readInteger(typeNode.value.value) === typeId) {
      const versionNode = parseAsn1(seq.value.value, typeNode.value.end);
      if (Option.isSome(versionNode)) {
        const valueNode = parseAsn1(seq.value.value, versionNode.value.end);
        if (Option.isSome(valueNode)) {
          const result = fn(valueNode.value.value);
          if (Option.isSome(result)) return result;
        }
      }
    }
    offset = seq.value.end;
  }
  return Option.none();
};

/**
 * Unwraps the OCTET STRING an in-app attribute value is wrapped in, falling
 * back to the value itself when it is not wrapped.
 */
const unwrapInnerSet = (inAppValue: string): string => {
  const parsed = parseAsn1(inAppValue, 0);
  if (Option.isSome(parsed)) return parsed.value.value;
  return inAppValue;
};

/**
 * Loads the inner ReceiptAttribute SET from a base64-encoded app receipt.
 * Returns the hex-encoded concatenation of receipt attribute SEQUENCEs (the
 * SET's value), ready to be iterated directly.
 */
const loadReceiptInfo = (appReceipt: string): Option.Option<string> => {
  const hex = bytesToHex(base64ToBytes(appReceipt));
  let receiptInfo = navigateToPath(hex, [1, 0, 2, 1, 0]);
  if (Option.isNone(receiptInfo)) return Option.none();
  let receiptInfoValue = receiptInfo.value;
  // Xcode wraps the SET in an extra OCTET STRING — unwrap it.
  if (receiptInfoValue.length > 2 && receiptInfoValue.startsWith("04")) {
    const unwrapped = parseAsn1(receiptInfoValue, 0);
    if (Option.isSome(unwrapped)) receiptInfoValue = unwrapped.value.value;
  }
  // Descend one more level to get the contents of the SET (its child sequences).
  const setParsed = parseAsn1(receiptInfoValue, 0);
  if (Option.isSome(setParsed)) return Option.some(setParsed.value.value);
  return Option.some(receiptInfoValue);
};

/**
 * Extracts a transaction ID from an encoded App Receipt. NO validation is
 * performed; data returned should only be used to call the App Store Server
 * API.
 *
 * @param appReceipt - The unmodified app receipt (base64 encoded)
 * @returns A transaction id from the first in-app purchase, or `Option.none()` if none.
 */
export const extractTransactionIdFromAppReceipt = (
  appReceipt: string,
): Effect.Effect<Option.Option<string>, ReceiptParseError> =>
  Effect.try({
    try: () => {
      const receiptInfo = loadReceiptInfo(appReceipt);
      if (Option.isNone(receiptInfo)) return Option.none();

      return forEachAttribute(receiptInfo.value, IN_APP_TYPE_ID, (inAppValue) => {
        // The in-app value itself is an OCTET STRING wrapping another SET.
        const innerSet = unwrapInnerSet(inAppValue);
        const idValue = Option.orElse(findAttribute(innerSet, TRANSACTION_IDENTIFIER_TYPE_ID), () =>
          findAttribute(innerSet, ORIGINAL_TRANSACTION_IDENTIFIER_TYPE_ID),
        );
        if (Option.isNone(idValue)) return Option.none();
        return readUtf8FromOctet(idValue.value);
      });
    },
    catch: (error) =>
      new ReceiptParseError({
        message: `Failed to parse app receipt: ${causeMessage(error)}`,
        cause: Option.some(error),
      }),
  });

/**
 * Extracts a transaction ID from an encoded transactional receipt (legacy
 * format). NO validation is performed.
 *
 * @param transactionReceipt - The unmodified transaction receipt (base64 encoded)
 * @returns A transaction id, or `Option.none()` if no transactionId is found.
 */
export const extractTransactionIdFromTransactionReceipt = (
  transactionReceipt: string,
): Effect.Effect<Option.Option<string>, ReceiptParseError> =>
  Effect.try({
    try: () => {
      const topLevel = bytesToUtf8(base64ToBytes(transactionReceipt));

      const topLevelRegex = /"purchase-info"\s*=\s*"([a-zA-Z0-9+/=]+)";/;
      const topLevelMatch = topLevel.match(topLevelRegex);
      if (!topLevelMatch || topLevelMatch.length !== 2) return Option.none();

      const purchaseInfoBase64 = topLevelMatch[1];
      if (!purchaseInfoBase64) return Option.none();

      const purchaseInfo = bytesToUtf8(base64ToBytes(purchaseInfoBase64));

      const purchaseInfoRegex = /"transaction-id"\s*=\s*"([a-zA-Z0-9+/=]+)";/;
      const purchaseInfoMatch = purchaseInfo.match(purchaseInfoRegex);
      if (!purchaseInfoMatch || purchaseInfoMatch.length !== 2) return Option.none();

      return Option.fromNullishOr(purchaseInfoMatch[1]);
    },
    catch: (error) =>
      new ReceiptParseError({
        message: `Failed to parse transaction receipt: ${causeMessage(error)}`,
        cause: Option.some(error),
      }),
  });

/**
 * Extracts a transaction ID from a receipt of either supported format.
 */
export const extractTransactionIdFromReceipt = (
  encodedReceipt: string,
): Effect.Effect<Option.Option<string>, ReceiptParseError> =>
  Effect.gen(function* () {
    const fromApp = yield* extractTransactionIdFromAppReceipt(encodedReceipt).pipe(
      Effect.catch(() => Effect.succeed(Option.none())),
    );
    if (Option.isSome(fromApp)) return fromApp;

    const fromTxn = yield* extractTransactionIdFromTransactionReceipt(encodedReceipt).pipe(
      Effect.catch(() => Effect.succeed(Option.none())),
    );
    return fromTxn;
  });

/**
 * Extracts every in-app transaction ID found in an App Receipt. Returns the
 * IDs in document order; if the receipt is a legacy transaction receipt, a
 * single-element array is returned.
 */
export const extractAllTransactionIdsFromReceipt = (
  encodedReceipt: string,
): Effect.Effect<string[], ReceiptParseError> =>
  Effect.gen(function* () {
    const ids: string[] = [];
    const receiptInfo = loadReceiptInfo(encodedReceipt);
    if (Option.isSome(receiptInfo)) {
      let offset = 0;
      while (offset < receiptInfo.value.length) {
        const seq = parseAsn1(receiptInfo.value, offset);
        if (Option.isNone(seq)) break;
        const typeNode = parseAsn1(seq.value.value, 0);
        if (Option.isSome(typeNode) && readInteger(typeNode.value.value) === IN_APP_TYPE_ID) {
          const versionNode = parseAsn1(seq.value.value, typeNode.value.end);
          if (Option.isSome(versionNode)) {
            const valueNode = parseAsn1(seq.value.value, versionNode.value.end);
            if (Option.isSome(valueNode)) {
              const innerSet = unwrapInnerSet(valueNode.value.value);
              const idValue = Option.orElse(
                findAttribute(innerSet, TRANSACTION_IDENTIFIER_TYPE_ID),
                () => findAttribute(innerSet, ORIGINAL_TRANSACTION_IDENTIFIER_TYPE_ID),
              );
              if (Option.isSome(idValue)) {
                const idString = readUtf8FromOctet(idValue.value);
                if (Option.isSome(idString)) ids.push(idString.value);
              }
            }
          }
        }
        offset = seq.value.end;
      }
      if (ids.length > 0) return ids;
    }

    // Fallback to legacy transactional receipt format.
    const legacy = yield* extractTransactionIdFromTransactionReceipt(encodedReceipt).pipe(
      Effect.catch(() => Effect.succeed(Option.none())),
    );
    if (Option.isSome(legacy)) ids.push(legacy.value);
    return ids;
  });
