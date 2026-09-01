import {
  EventAdmissionService,
  type ResolvedEventAdmissionPolicy,
} from "../analytics/EventAdmissionService.ts";
import {
  EventAdmissionRpcsDef,
  RpcActionForbiddenError,
  RpcEventAdmissionServiceError,
} from "@voidhash/rpc";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

const toRpcError = {
  ActionForbiddenError: (error: { readonly message: string }) =>
    Effect.fail(new RpcActionForbiddenError({ message: error.message })),
  EventAdmissionServiceError: (error: { readonly message: string }) =>
    Effect.fail(new RpcEventAdmissionServiceError({ message: error.message })),
};

const toRpcPolicy = (policy: ResolvedEventAdmissionPolicy) => ({
  builtinEvents: policy.builtinEvents.map(
    ({ defaultEnabled, enabled, override, warning, ...event }) => ({
      ...event,
      override: Option.getOrNull(override),
      warning: Option.getOrNull(warning),
      isDefaultEnabled: defaultEnabled,
      isEnabled: enabled,
    }),
  ),
  customEventBlocklist: policy.customEventBlocklist,
});

export const EventAdmissionRpcsLive = EventAdmissionRpcsDef.toLayer(
  Effect.gen(function* EventAdmissionRpcsLive() {
    const eventAdmission = yield* EventAdmissionService;
    return {
      GetEventAdmissionPolicy: ({ projectId }) =>
        eventAdmission.getPolicy(projectId).pipe(
          Effect.map(toRpcPolicy),
          Effect.catchTags(toRpcError),
        ),
      SetBuiltinEventAdmission: (payload) =>
        eventAdmission
          .setBuiltinEventEnabled(payload)
          .pipe(Effect.map(toRpcPolicy), Effect.catchTags(toRpcError)),
      SetCustomEventBlocked: (payload) =>
        eventAdmission
          .setCustomEventBlocked(payload)
          .pipe(Effect.map(toRpcPolicy), Effect.catchTags(toRpcError)),
    };
  }),
);
