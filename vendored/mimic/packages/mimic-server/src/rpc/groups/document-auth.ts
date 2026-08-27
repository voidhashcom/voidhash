import { Schema } from "effect";
import { Rpc, RpcGroup } from "effect/unstable/rpc";

import { ForbiddenError, NotFoundError } from "../errors.ts";
import { AuthMiddleware } from "../middleware.ts";
import { DocumentAuthenticationSetupSchema, DocumentPermissionSchema } from "../schemas.ts";

export const SetupDocumentAuthentication = Rpc.make("SetupDocumentAuthentication", {
  payload: Schema.Struct({
    collectionId: Schema.String,
    documentId: Schema.String,
    permission: DocumentPermissionSchema,
    origins: Schema.Array(Schema.String),
    expiresInSeconds: Schema.optional(Schema.Number),
  }),
  success: DocumentAuthenticationSetupSchema,
  error: Schema.Union([NotFoundError, ForbiddenError]),
});

export const DocumentAuthRpcs = RpcGroup.make(SetupDocumentAuthentication).middleware(
  AuthMiddleware,
);
