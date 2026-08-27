import { causeMessage } from "@voidhash/lib/lang";
import {
  parseSchema,
  serializeSchema,
  validate as validateSchemaValue,
  validateValue,
  type SchemaObject,
  type Value,
} from "@voidhash/mimic-core";
import { InvalidSchemaError, InvalidValueError } from "@voidhash/mimic-server/rpc";
import { Effect } from "effect";

import { decodeDocumentValue } from "./transaction.ts";

const normalizeSchemaObjectEffect = (
  input: unknown,
): Effect.Effect<SchemaObject, InvalidSchemaError> =>
  Effect.try({
    try: () => serializeSchema(parseSchema(input)),
    catch: (error) =>
      new InvalidSchemaError({ code: "invalid_schema", message: causeMessage(error) }),
  });

/**
 * Parses and re-serializes a collection schema, failing with `InvalidSchemaError`.
 *
 * Stays synchronous — the control engine builds schema objects inside plain
 * `Effect.try` blocks — so the tagged failure is surfaced by `Effect.runSync`,
 * which rethrows the very error the effect failed with.
 */
export const normalizeSchemaObject = (input: unknown): SchemaObject =>
  Effect.runSync(normalizeSchemaObjectEffect(input));

const sanitizeValueForSchemaEffect = (
  schemaObject: SchemaObject,
  input: unknown,
): Effect.Effect<Value, InvalidValueError> =>
  Effect.try({
    try: () => {
      const value = decodeDocumentValue(input);
      validateValue(value);
      const schema = parseSchema(schemaObject);
      // `validate` is typed `Value | undefined` for the default-materialization
      // path it shares with absent values; a provided value always validates to
      // a value.
      return decodeDocumentValue(validateSchemaValue(schema, value));
    },
    catch: (error) =>
      new InvalidValueError({ code: "invalid_value", message: causeMessage(error) }),
  });

/** Validates a value against a collection schema, failing with `InvalidValueError`. */
export const sanitizeValueForSchema = (schemaObject: SchemaObject, input: unknown): Value =>
  Effect.runSync(sanitizeValueForSchemaEffect(schemaObject, input));
