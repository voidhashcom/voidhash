import { EventAdmissionPolicy, VoidhashV1Api } from "@voidhash/api-contracts";
import { ApiActionForbiddenError, ApiEventAdmissionError } from "@voidhash/api-contracts/errors";
import {
  EventAdmissionService,
  type ResolvedEventAdmissionPolicy,
} from "../../analytics/EventAdmissionService.ts";
import { resolveRequestProjectId } from "@voidhash/core/utils";
import { AuthSession } from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { bridgeAuthSession, requireCredential } from "../../ApiMiddlewares.ts";

const toApiError = {
  ActionForbiddenError: (e: { readonly message: string }) =>
    Effect.fail(new ApiActionForbiddenError({ message: e.message })),
  EventAdmissionServiceError: (e: { readonly message: string }) =>
    Effect.fail(new ApiEventAdmissionError({ message: e.message })),
};

const toApiPolicy = (policy: ResolvedEventAdmissionPolicy) =>
  new EventAdmissionPolicy({
    builtinEvents: policy.builtinEvents.map(
      ({ defaultEnabled, enabled, override, warning, ...event }) => ({
        ...event,
        isDefaultEnabled: defaultEnabled,
        isEnabled: enabled,
        override: Option.getOrNull(override),
        warning: Option.getOrNull(warning),
      }),
    ),
    customEventBlocklist: policy.customEventBlocklist,
  });

export const IngestPolicyGroupLive = HttpApiBuilder.group(
  VoidhashV1Api,
  "ingest_policy",
  (handlers) =>
    Effect.gen(function* () {
      const eventAdmission = yield* EventAdmissionService;

      return handlers
        .handle("getIngestPolicy", ({ query }) =>
          bridgeAuthSession(
            Effect.fn("IngestPolicyGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              const projectId = yield* resolveRequestProjectId(authSession, query.projectId);
              const policy = yield* eventAdmission.getPolicy(projectId);
              return toApiPolicy(policy);
            })(),
          ).pipe(Effect.catchTags(toApiError)),
        )
        .handle("setBuiltinEventAdmission", ({ params, payload }) =>
          bridgeAuthSession(
            Effect.fn("IngestPolicyGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
              const policy = yield* eventAdmission.setBuiltinEventEnabled({
                enabled: payload.enabled,
                key: params.key,
                projectId,
              });
              return toApiPolicy(policy);
            })(),
          ).pipe(Effect.catchTags(toApiError)),
        )
        .handle("setCustomEventBlocked", ({ params, payload }) =>
          bridgeAuthSession(
            Effect.fn("IngestPolicyGroupLive")(function* () {
              const authSession = yield* AuthSession;
              yield* requireCredential(authSession, ["user", "secret-key"]);
              const projectId = yield* resolveRequestProjectId(authSession, payload.projectId);
              const policy = yield* eventAdmission.setCustomEventBlocked({
                blocked: payload.blocked,
                eventName: params.eventName,
                projectId,
              });
              return toApiPolicy(policy);
            })(),
          ).pipe(Effect.catchTags(toApiError)),
        );
    }),
);
