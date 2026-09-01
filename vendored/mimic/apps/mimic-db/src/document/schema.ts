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
import * as Result from "effect/Result";

import { decodeDocumentValue } from "./transaction.ts";

/**
 * Parses and re-serializes a collection schema, failing with `InvalidSchemaError`.
 *
 * Stays synchronous — the control engine builds schema objects inside plain
 * `Effect.try` blocks — so the tagged failure is surfaced by `Effect.runSync`,
 * which rethrows the very error the effect failed with.
 */
export const normalizeSchemaObject = (input: unknown): SchemaObject =>
  Result.try(() => serializeSchema(parseSchema(input))).pipe(
    Result.getOrThrowWith(
      (error) => new InvalidSchemaError({ code: "invalid_schema", message: causeMessage(error) }),
    ),
  );

/** Validates a value against a collection schema, failing with `InvalidValueError`. */
export const sanitizeValueForSchema = (schemaObject: SchemaObject, input: unknown): Value =>
  Result.try(() => {
    const value = decodeDocumentValue(input);
    validateValue(value);
    return decodeDocumentValue(validateSchemaValue(parseSchema(schemaObject), value));
  }).pipe(
    Result.getOrThrowWith(
      (error) => new InvalidValueError({ code: "invalid_value", message: causeMessage(error) }),
    ),
  );
