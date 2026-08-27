import { EventAdmissionService } from "../analytics/EventAdmissionService.ts";
import {
  EventAdmissionRpcsDef,
  RpcActionForbiddenError,
  RpcEventAdmissionServiceError,
} from "@voidhash/rpc";
import { Effect } from "effect";

const toRpcError = {
  ActionForbiddenError: (error: { readonly message: string }) =>
    Effect.fail(new RpcActionForbiddenError({ message: error.message })),
  EventAdmissionServiceError: (error: { readonly message: string }) =>
    Effect.fail(new RpcEventAdmissionServiceError({ message: error.message })),
};

export const EventAdmissionRpcsLive = EventAdmissionRpcsDef.toLayer(
  Effect.gen(function* EventAdmissionRpcsLive() {
    const eventAdmission = yield* EventAdmissionService;
    return {
      GetEventAdmissionPolicy: ({ projectId }) =>
        eventAdmission.getPolicy(projectId).pipe(Effect.catchTags(toRpcError)),
      SetBuiltinEventAdmission: (payload) =>
        eventAdmission.setBuiltinEventEnabled(payload).pipe(Effect.catchTags(toRpcError)),
      SetCustomEventBlocked: (payload) =>
        eventAdmission.setCustomEventBlocked(payload).pipe(Effect.catchTags(toRpcError)),
    };
  }),
);
