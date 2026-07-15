import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

export interface AgentSessionScope {
  readonly organizationId: string;
  readonly projectId: string;
  readonly surface: string;
  readonly paywallId?: string;
}

/** Lists durable Pi sessions for one studio surface, newest first. */
export const listAgentSessionsOptions = (scope: AgentSessionScope) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListAgentSessions(scope)),
    queryKey: queryKeys.agentSession.list(scope),
  });

/** Deletes one durable session index row owned by the authenticated user. */
export const deleteAgentSessionOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { sessionId: string }) =>
      VoidhashRpc.request((rpc) => rpc.DeleteAgentSession(variables)),
    mutationKey: ["deleteAgentSession"],
  });

/** Reverts the latest reviewed paywall change set owned by a durable session. */
export const revertAgentSessionChangeSetOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { sessionId: string; changeSetId: string }) =>
      VoidhashRpc.request((rpc) => rpc.RevertAgentSessionChangeSet(variables)),
    mutationKey: ["revertAgentSessionChangeSet"],
  });

/** Uploads one image for a session prompt and returns its public URL. */
export const uploadAgentAttachmentOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      sessionId: string;
      organizationId: string;
      name: string;
      contentType: string;
      dataBase64: string;
    }) => VoidhashRpc.request((rpc) => rpc.UploadAgentAttachment(variables)),
    mutationKey: ["uploadAgentAttachment"],
  });
