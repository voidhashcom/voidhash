import { AuthMiddleware } from "@voidhash/api-contracts";
import { ApiAuthenticationError, ApiNotAuthenticatedError } from "@voidhash/api-contracts/errors";
import { describe, expect, it } from "vite-plus/test";

describe("AuthMiddleware", () => {
  it("keeps authentication failures as separate status-aware schemas", () => {
    expect(AuthMiddleware.error.size).toBe(2);
    expect(AuthMiddleware.error.has(ApiAuthenticationError)).toBe(true);
    expect(AuthMiddleware.error.has(ApiNotAuthenticatedError)).toBe(true);
  });
});
