import type * as Order from "effect/Order";

/** Adapts a JavaScript numeric comparator to an Effect `Order`. */
export const orderFromCompare = <A>(compare: (left: A, right: A) => number): Order.Order<A> =>
  (left, right) => {
    const result = compare(left, right);
    return result < 0 ? -1 : result > 0 ? 1 : 0;
  };
