import { RpcGroups } from "@voidhash/rpc";
import { describe, expect, it } from "vitest";

import { BackendRpcGroups } from "./BackendRpcGroups.ts";

describe("backend RPC composition", () => {
  it("uses only the Community product transport before extensions mount", () => {
    expect([...BackendRpcGroups.requests.keys()]).toEqual([...RpcGroups.requests.keys()]);
  });

  it("does not mount private operations procedures", () => {
    expect(
      [...BackendRpcGroups.requests.keys()].filter((tag) => tag.startsWith("Admin")),
    ).toEqual([]);
  });
});
