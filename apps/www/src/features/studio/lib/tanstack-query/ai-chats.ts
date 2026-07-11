import { queryKeys } from "@/features/studio/lib/tanstack-query";

import { VoidhashRpc, eq } from "../effect-query";

// Queries

/** List a paywall/surface's persistent chats (metadata only), newest first. */
export const listAiChatsOptions = (options: {
  organizationId: string;
  projectId: string;
  surface: string;
  paywallId?: string;
}) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.ListAiChats(options)),
    queryKey: queryKeys.aiChat.list(options),
  });

/** Load one full chat (including its serialized messages). */
export const getAiChatOptions = (chatId: string) =>
  eq.queryOptions({
    queryFn: () => VoidhashRpc.request((rpc) => rpc.GetAiChat({ chatId })),
    queryKey: queryKeys.aiChat.get(chatId),
  });

// Mutations

/** Upsert a chat by its (client-minted) id. */
export const saveAiChatOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      id: string;
      organizationId: string;
      projectId: string;
      surface: string;
      chatType: string;
      paywallId?: string;
      title: string;
      messages: string;
    }) => VoidhashRpc.request((rpc) => rpc.SaveAiChat(variables)),
    mutationKey: ["saveAiChat"],
  });

/** Delete one chat. */
export const deleteAiChatOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: { chatId: string }) =>
      VoidhashRpc.request((rpc) => rpc.DeleteAiChat(variables)),
    mutationKey: ["deleteAiChat"],
  });

/** Upload an image attachment under a chat; returns its public URL. */
export const uploadAiChatAttachmentOptions = () =>
  eq.mutationOptions({
    mutationFn: (variables: {
      chatId: string;
      organizationId: string;
      name: string;
      contentType: string;
      dataBase64: string;
    }) => VoidhashRpc.request((rpc) => rpc.UploadAiChatAttachment(variables)),
    mutationKey: ["uploadAiChatAttachment"],
  });
