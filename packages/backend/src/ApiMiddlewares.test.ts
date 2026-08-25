import { AuthMiddleware } from "@voidhash/api-contracts";
import {
  ApiAuthenticationError,
  ApiAuthServiceError,
  ApiNotAuthenticatedError,
} from "@voidhash/api-contracts/errors";
import { describe, expect, it } from "vite-plus/test";

describe("AuthMiddleware", () => {
  it("keeps authentication failures as separate status-aware schemas", () => {
    expect(AuthMiddleware.error.size).toBe(3);
    expect(AuthMiddleware.error.has(ApiAuthenticationError)).toBe(true);
    expect(AuthMiddleware.error.has(ApiAuthServiceError)).toBe(true);
    expect(AuthMiddleware.error.has(ApiNotAuthenticatedError)).toBe(true);
  });

  it("separates a caller's bad credential from a failure of the auth dependencies", () => {
    // The whole point of the split: a wrong key must not read as a server
    // outage, and a database outage must not read as a wrong key.
    expect(ApiNotAuthenticatedError.ast.annotations?.httpApiStatus).toBe(401);
    expect(ApiAuthenticationError.ast.annotations?.httpApiStatus).toBe(401);
    expect(ApiAuthServiceError.ast.annotations?.httpApiStatus).toBe(500);
  });
});
