import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { paginate, sortById } from "../../src/utils/pagination.ts";

const items = [{ id: "item_c" }, { id: "item_a" }, { id: "item_d" }, { id: "item_b" }];

describe("in-memory pagination ordering", () => {
  it("walks every item once when the source order changes between pages", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const first = yield* paginate(
          sortById(items, (item) => item.id),
          (item) => item.id,
          { limit: 2 },
        );
        const second = yield* paginate(
          sortById([...items].reverse(), (item) => item.id),
          (item) => item.id,
          {
            cursor: first.pageInfo.endCursor ?? undefined,
            limit: 2,
          },
        );

        expect([...first.data, ...second.data].map((item) => item.id)).toEqual([
          "item_a",
          "item_b",
          "item_c",
          "item_d",
        ]);
        expect(second.pageInfo).toEqual({ endCursor: null, hasNextPage: false });
      }),
    ));
});
