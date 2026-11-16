import * as Arr from "effect/Array";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";

import { InvalidArgumentError } from "../errors";

/** A value a person trait can hold. The person API stores flat scalars only. */
// oxlint-disable-next-line effect/prefer-option-over-null -- a JSON trait value; `null` clears the trait.
type TraitValue = string | number | boolean | null;

const isTraitValue = (value: unknown): value is TraitValue =>
  value === null || P.isString(value) || P.isNumber(value) || P.isBoolean(value);

/**
 * Why `attributes` can never be written, or `None` when they can. The person
 * API stores flat traits only, so a nested object or an array is refused here,
 * before anything is sent or queued, whether or not the device is online.
 */
export const invalidPersonAttributes = (
  attributes: unknown,
): Option.Option<InvalidArgumentError> => {
  if (!P.isObject(attributes)) {
    return Option.some(new InvalidArgumentError("Person attributes must be an object"));
  }
  const invalidKeys = R.keys(
    R.filter(attributes, (value, key) =>
      key === "email" || key === "name"
        ? value !== undefined && !P.isString(value)
        : value !== undefined && !isTraitValue(value),
    ),
  );
  return Arr.match(invalidKeys, {
    onEmpty: () => Option.none(),
    onNonEmpty: (keys) =>
      Option.some(
        new InvalidArgumentError(
          `Invalid person attributes (${keys.join(", ")}): trait values must be strings, numbers, booleans or null, and email and name must be strings`,
        ),
      ),
  });
};
