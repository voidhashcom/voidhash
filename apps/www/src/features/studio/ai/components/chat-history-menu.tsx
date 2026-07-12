import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Spinner,
} from "@voidhash/ui";
import { HistoryIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  deleteAiChatOptions,
  getAiChatOptions,
  listAiChatsOptions,
  queryKeys,
} from "@/features/studio/lib/tanstack-query";

import type { SurfaceAgent } from "../contract";

interface ChatHistoryMenuProps {
  agent: SurfaceAgent;
  /** The chat currently shown, so deleting it can reset to a new chat. */
  currentChatId: string;
  /** Start a fresh chat. */
  onNewChat: () => void;
  /** Reopen a stored chat with its decoded messages. */
  onSelectChat: (chatId: string, messages: UIMessage[]) => void;
}

/** Short relative time (e.g. "just now", "3h ago", "2d ago"). */
function relativeTime(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/**
 * Panel-header controls for a persistent chat surface: a "new chat" button and a
 * "history" dropdown listing this surface/paywall's stored chats (newest first).
 * Selecting a row fetches its full messages and reopens it; the trash button
 * deletes it. The history dropdown only renders for a `persistent` surface.
 */
export function ChatHistoryMenu({
  agent,
  currentChatId,
  onNewChat,
  onSelectChat,
}: ChatHistoryMenuProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loadingChatId, setLoadingChatId] = useState<string | null>(null);

  const { organizationId, projectId, paywallId } = agent.context;
  const surface = agent.surfaceId;
  const isPersistent = agent.persistence?.chatType === "persistent";
  const hasScope = Boolean(organizationId && projectId);
  const scope = { organizationId, projectId, surface, paywallId };

  const chatsQuery = useQuery({
    ...listAiChatsOptions(scope),
    enabled: open && isPersistent && hasScope,
  });

  const deleteChat = useMutation(deleteAiChatOptions());

  const handleSelect = async (chatId: string) => {
    setLoadingChatId(chatId);
    try {
      const chat = await queryClient.fetchQuery(getAiChatOptions(chatId));
      const parsed = JSON.parse(chat.messages) as UIMessage[];
      onSelectChat(chatId, parsed);
      setOpen(false);
    } catch {
      toast.error("Could not open that chat.");
    } finally {
      setLoadingChatId(null);
    }
  };

  const handleDelete = (chatId: string) => {
    deleteChat.mutate(
      { chatId },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.aiChat.list(scope) });
          if (chatId === currentChatId) {
            onNewChat();
          }
        },
        onError: () => toast.error("Could not delete that chat."),
      },
    );
  };

  const chats = chatsQuery.data ?? [];

  return (
    <div className="flex items-center gap-1">
      <Button aria-label="New chat" onClick={onNewChat} size="icon-sm" title="New chat" variant="ghost">
        <PlusIcon className="size-4" />
      </Button>

      {isPersistent ? (
        <DropdownMenu onOpenChange={setOpen} open={open}>
          <DropdownMenuTrigger asChild>
            <Button aria-label="Chat history" size="icon-sm" title="Chat history" variant="ghost">
              <HistoryIcon className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Chat history</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {chatsQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 px-2 py-4 text-sm text-muted-foreground">
                <Spinner /> Loading…
              </div>
            ) : chats.length === 0 ? (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No previous chats
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={cn(
                      "group flex items-center gap-1 rounded-sm px-2 py-1.5 hover:bg-accent",
                      chat.id === currentChatId && "bg-accent/50",
                    )}
                  >
                    <button
                      className="flex min-w-0 flex-1 flex-col items-start text-left"
                      disabled={loadingChatId !== null}
                      onClick={() => void handleSelect(chat.id)}
                      type="button"
                    >
                      <span className="w-full truncate text-sm">{chat.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {loadingChatId === chat.id ? "Opening…" : relativeTime(chat.updatedAt)}
                      </span>
                    </button>
                    <Button
                      aria-label={`Delete ${chat.title}`}
                      className="shrink-0 opacity-0 group-hover:opacity-100"
                      onClick={() => handleDelete(chat.id)}
                      size="icon-xs"
                      variant="ghost"
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
