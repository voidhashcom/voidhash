import { describe, expect, it } from "vitest";

import { AuthMiddleware, MimicRpcGroup } from "../../src/rpc/index.js";

describe("MimicRpcGroup", () => {
  it("exposes the expected procedure tags", () => {
    const tags = [...MimicRpcGroup.requests.keys()].sort();
    expect(tags).toEqual([
      "CloseDocumentConnection",
      "CreateCollection",
      "CreateDatabase",
      "CreateDocument",
      "CreateUser",
      "DeleteCollection",
      "DeleteDatabase",
      "DeleteDocument",
      "DeleteUser",
      "GetConnectedDocument",
      "GetDocument",
      "GrantPermission",
      "HeartbeatDocumentConnection",
      "ListCollections",
      "ListDatabases",
      "ListDocuments",
      "ListGrants",
      "ListUsers",
      "OpenDocumentConnection",
      "RevokePermission",
      "SetupDocumentAuthentication",
      "SubmitConnectedTransaction",
      "SubmitTransaction",
    ]);
  });

  it("applies AuthMiddleware to every procedure", () => {
    for (const rpc of MimicRpcGroup.requests.values()) {
      const middlewares = rpc.middlewares;
      expect(middlewares.size).toBe(1);
      expect(middlewares.has(AuthMiddleware)).toBe(true);
    }
  });
});
