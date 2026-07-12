import { CollectionsRpcs } from "./groups/collections.ts";
import { DatabasesRpcs } from "./groups/databases.ts";
import { DocumentAuthRpcs } from "./groups/document-auth.ts";
import { DocumentsRpcs } from "./groups/documents.ts";
import { GrantsRpcs } from "./groups/grants.ts";
import { UsersRpcs } from "./groups/users.ts";

/**
 * The unified RPC contract for the mimic-db public API.
 *
 * This is the single source of truth shared between server (`apps/mimic-db`)
 * and client (the `@voidhash/mimic-server` SDK). Importing it from one side or the other
 * is what gives us end-to-end type safety: payload, success, and error
 * schemas are checked against the same definitions.
 *
 * The `AuthMiddleware` declared here means every procedure requires an
 * authenticated user. Server provides `CurrentUser` via the middleware
 * implementation; clients send credentials via the `Authorization` HTTP
 * header on the underlying transport.
 */
export const MimicRpcGroup = DatabasesRpcs.merge(
  CollectionsRpcs,
  DocumentsRpcs,
  UsersRpcs,
  GrantsRpcs,
  DocumentAuthRpcs,
);
