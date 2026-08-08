import { describe, expect, it } from "vite-plus/test";

import { getPersonByDistinctIdOptions } from "./persons";
import { queryKeys } from "./query-keys";

describe("person query options", () => {
  it("uses the distinct-id person query key", () => {
    const options = getPersonByDistinctIdOptions({
      distinctId: "distinct_123",
      projectId: "project_123",
    });

    expect(options.queryKey).toEqual(
      queryKeys.person.getPersonByDistinctId("project_123", "distinct_123"),
    );
  });
});
