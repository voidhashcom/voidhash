import { EventAdmissionPolicy, VoidhashV1Api } from "@voidhash/api-contracts";
import { ApiActionForbiddenError, ApiEventAdmissionError } from "@voidhash/api-contracts/errors";
import { EventAdmissionService } from "@voidhash/core/services";
import { resolveRequestProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession, requireCredential } from "../../ApiMiddlewares.ts";

const toApiError = {
  ActionForbiddenError: (e: { readonly message: string }) =>
    Effect.fail(new ApiActionForbiddenError({ message: e.message })),
  EventAdmissionServiceError: (e: { readonly message: string }) =>
    Effect.fail(new ApiEventAdmissionError({ message: e.message })),
};

export const IngestPolicyGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "ingest_policy",
  (handlers) =>
    Effect.gen(function* () {
      const eventAdmission = yield* EventAdmissionService;

      return handlers
        .handle("getIngestPolicy", ({ query }) =>
          bridgeAuthSession(
            Effect.gen(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
              const policy = yield* eventAdmission.getPolicy(projectId);
              return new EventAdmissionPolicy(policy);
            }),
          ).pipe(Effect.catchTags(toApiError)),
        )
        .handle("setBuiltinEventAdmission", ({ params, payload }) =>
          bridgeAuthSession(
            Effect.gen(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
              const policy = yield* eventAdmission.setBuiltinEventEnabled({
                enabled: payload.enabled,
                key: params.key,
                projectId,
              });
              return new EventAdmissionPolicy(policy);
            }),
          ).pipe(Effect.catchTags(toApiError)),
        )
        .handle("setCustomEventBlocked", ({ params, payload }) =>
          bridgeAuthSession(
            Effect.gen(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
              const policy = yield* eventAdmission.setCustomEventBlocked({
                blocked: payload.blocked,
                eventName: params.eventName,
                projectId,
              });
              return new EventAdmissionPolicy(policy);
            }),
          ).pipe(Effect.catchTags(toApiError)),
        );
    }),
);
