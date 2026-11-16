import * as R from "effect/Record";
import * as P from "effect/Predicate";

import { isJsonObject } from "../json";

import type { VoidhashTraits } from "../../types";

/**
 * A person trait as Voidhash stores it: a flat scalar, or `null` to clear the
 * trait. Anything that needs structure belongs on an event instead.
 */
// oxlint-disable-next-line effect/prefer-option-over-null -- `null` is the wire value that clears a trait.
type PersonTraitValue = string | number | boolean | null;
export type PersonTraits = Readonly<Record<string, PersonTraitValue>>;

const isPersonTraitValue = (value: unknown): value is PersonTraitValue =>
  value === null || P.isString(value) || P.isNumber(value) || P.isBoolean(value);

/** Whether a value read back from storage holds only person traits. */
export const isPersonTraits = (value: unknown): value is PersonTraits =>
  isJsonObject(value) && Object.values(value).every(isPersonTraitValue);

/**
 * Traits ready to send: only the flat values Voidhash stores, without the
 * `undefined` entries of optional fields. A value of another kind, which
 * plain JavaScript callers can pass, is left out rather than sent as an
 * object Voidhash refuses.
 */
export const toPersonTraits = (
  traits: VoidhashTraits | Readonly<Record<string, unknown>>,
): PersonTraits => R.filter(traits, isPersonTraitValue);
