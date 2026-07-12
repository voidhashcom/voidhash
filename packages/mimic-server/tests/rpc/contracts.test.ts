import { describe, expect, it } from "vitest";

import { AuthMiddleware, MimicRpcGroup } from "../../src/rpc/index.js";

describe("MimicRpcGroup", () => {
  it("exposes the expected procedure tags", () => {
    const tags = [...MimicRpcGroup.requests.keys()].sort();
    expect(tags).toEqual([
      "CreateCollection",
      "CreateDatabase",
      "CreateDocument",
      "CreateUser",
      "DeleteCollection",
      "DeleteDatabase",
      "DeleteDocument",
      "DeleteUser",
      "GetDocument",
      "GrantPermission",
      "ListCollections",
      "ListDatabases",
      "ListDocuments",
      "ListGrants",
      "ListUsers",
      "RevokePermission",
      "SetupDocumentAuthentication",
      "SubmitTransaction",
    ]);
  });

  it("applies AuthMiddleware to every procedure", () => {
    for (const rpc of MimicRpcGroup.requests.values()) {
      const middlewares = (rpc as { readonly middlewares: ReadonlySet<unknown> }).middlewares;
      expect(middlewares.size).toBe(1);
      expect(middlewares.has(AuthMiddleware)).toBe(true);
    }
  });
});
