import { useMutation } from "@tanstack/react-query";
import type { UIMessage } from "ai";
import { isToolUIPart } from "ai";
import {
  Attachment,
  AttachmentContent,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  Bubble,
  BubbleContent,
  cn,
  Message,
  MessageContent,
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@voidhash/ui";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Streamdown } from "streamdown";

import { uploadAiChatAttachmentOptions } from "@/features/studio/lib/tanstack-query";

import {
  composeMessage,
  isImageType,
  isTextFile,
  MAX_ATTACHMENT_BYTES,
  MAX_TEXT_ATTACHMENT_BYTES,
  type PendingAttachment,
  readAsDataUrl,
  readAsText,
} from "../attachments";
import type { SurfaceAgent } from "../contract";
import { useSurfaceChat } from "../use-surface-chat";
import { PromptInput } from "./prompt-input";
import { ToolCallView } from "./tool-call";

interface ChatShellProps {
  agent: SurfaceAgent;
  /** Identity of the chat being shown; hosts remount (keyed by this) to switch chats. */
  chatId: string;
  /** Seed messages when reopening a stored chat. */
  initialMessages?: UIMessage[];
  /** Rendered in the message area when there are no messages yet. */
  emptyState?: ReactNode;
  /** Called right before each user message is sent (e.g. to open a checkpoint window). */
  onBeforeSend?: () => void;
  /** Reports whether the assistant is submitting or streaming. */
  onBusyChange?: (isBusy: boolean) => void;
  className?: string;
}

/** Whether a message has any visible text content (used to gate the "thinking" marker). */
function hasRenderedText(message: UIMessage): boolean {
  return message.parts.some(
    (part) => part.type === "text" && part.text.trim().length > 0,
  );
}

/** Render a sent image `file` part as a vertical image-variant attachment card. */
function ImageAttachment({ url, name }: { url: string; name: string }) {
  return (
    <Attachment orientation="vertical">
      <AttachmentMedia variant="image">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={name} src={url} />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{name}</AttachmentTitle>
      </AttachmentContent>
    </Attachment>
  );
}

/** Render the parts of one assistant message: text via Streamdown, tool calls via ToolCallView. */
function AssistantMessage({ message }: { message: UIMessage }) {
  return (
    <Message align="start">
      <MessageContent>
        {message.parts.map((part, index) => {
          const key = `${message.id}-${index}`;
          if (part.type === "text") {
            return (
              <Streamdown
                key={key}
                className="prose prose-sm dark:prose-invert max-w-none min-w-0"
              >
                {part.text}
              </Streamdown>
            );
          }
          if (part.type === "dynamic-tool" || isToolUIPart(part)) {
            return <ToolCallView key={key} part={part} />;
          }
          if (part.type === "reasoning" && part.text.trim().length > 0) {
            return (
              <div
                key={key}
                className="text-xs text-muted-foreground italic wrap-break-word"
              >
                {part.text}
              </div>
            );
          }
          return null;
        })}
      </MessageContent>
    </Message>
  );
}

/** Render one user message as an end-aligned bubble with its text and image attachments. */
function UserMessage({ message }: { message: UIMessage }) {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("");
  const imageParts = message.parts.filter(
    (part) => part.type === "file" && part.mediaType.startsWith("image/"),
  );

  return (
    <Message align="end">
      <MessageContent className="items-end">
        {imageParts.length > 0 ? (
          <AttachmentGroup>
            {imageParts.map((part, index) =>
              part.type === "file" ? (
                <ImageAttachment
                  key={`${message.id}-img-${index}`}
                  url={part.url}
                  name={part.filename ?? "attachment"}
                />
              ) : null,
            )}
          </AttachmentGroup>
        ) : null}
        {text.trim().length > 0 ? (
          <Bubble align="end">
            <BubbleContent className="whitespace-pre-wrap">{text}</BubbleContent>
          </Bubble>
        ) : null}
      </MessageContent>
    </Message>
  );
}

/**
 * Host-agnostic, full-height chat surface. Renders the message list inside an
 * anchored scroller (with a scroll-to-bottom button), a "thinking" shimmer while
 * the assistant is working with no text yet, and the composer at the bottom.
 * Owns the composer's attachment queue: images upload to R2 (under this chat)
 * and text/code files are read and inlined at send time. Contains no fixed
 * positioning — the host decides where the shell lives.
 */
export function ChatShell({
  agent,
  chatId,
  initialMessages,
  emptyState,
  onBeforeSend,
  onBusyChange,
  className,
}: ChatShellProps) {
  const { messages, sendMessage, status, stop } = useSurfaceChat(agent, {
    chatId,
    initialMessages,
  });

  const uploadAttachment = useMutation(uploadAiChatAttachmentOptions());
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);

  const patch = useCallback((id: string, next: Partial<PendingAttachment>) => {
    setAttachments((prev) =>
      prev.map((attachment) => (attachment.id === id ? { ...attachment, ...next } : attachment)),
    );
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      for (const file of files) {
        const id = crypto.randomUUID();

        if (isImageType(file.type)) {
          if (file.size > MAX_ATTACHMENT_BYTES) {
            toast.error(`"${file.name}" is too large (max 8 MB).`);
            continue;
          }
          const previewUrl = URL.createObjectURL(file);
          setAttachments((prev) => [
            ...prev,
            {
              id,
              name: file.name,
              contentType: file.type,
              sizeBytes: file.size,
              kind: "image",
              status: "uploading",
              previewUrl,
            },
          ]);
          void (async () => {
            try {
              const dataBase64 = await readAsDataUrl(file);
              const result = await uploadAttachment.mutateAsync({
                chatId,
                organizationId: agent.context.organizationId,
                name: file.name,
                contentType: file.type,
                dataBase64,
              });
              patch(id, { status: "ready", url: result.url });
            } catch (error) {
              patch(id, {
                status: "error",
                error: error instanceof Error ? error.message : "Upload failed",
              });
            }
          })();
        } else if (isTextFile(file)) {
          if (file.size > MAX_TEXT_ATTACHMENT_BYTES) {
            toast.error(`"${file.name}" is too large to inline (max 256 KB).`);
            continue;
          }
          setAttachments((prev) => [
            ...prev,
            {
              id,
              name: file.name,
              contentType: file.type || "text/plain",
              sizeBytes: file.size,
              kind: "text",
              status: "uploading",
            },
          ]);
          void (async () => {
            try {
              const content = await readAsText(file);
              patch(id, { status: "ready", text: content });
            } catch (error) {
              patch(id, {
                status: "error",
                error: error instanceof Error ? error.message : "Could not read file",
              });
            }
          })();
        } else {
          toast.error(`"${file.name}" is not a supported attachment type.`);
        }
      }
    },
    [agent.context.organizationId, chatId, patch, uploadAttachment],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const target = prev.find((attachment) => attachment.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((attachment) => attachment.id !== id);
    });
  }, []);

  // Revoke any outstanding preview object URLs when the shell unmounts.
  useEffect(
    () => () => {
      setAttachments((prev) => {
        for (const attachment of prev) {
          if (attachment.previewUrl) {
            URL.revokeObjectURL(attachment.previewUrl);
          }
        }
        return prev;
      });
    },
    [],
  );

  const submit = (rawText: string) => {
    const { text, files } = composeMessage(rawText, attachments);
    if (text.length === 0 && files.length === 0) {
      return;
    }
    onBeforeSend?.();
    if (text.length === 0) {
      void sendMessage({ files });
    } else {
      void sendMessage({ text, files });
    }
    // Clear the queue (previews are freed on removal/unmount; the sent images
    // now render from their uploaded URLs in the message list).
    for (const attachment of attachments) {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
      }
    }
    setAttachments([]);
  };

  const isBusy = status === "submitted" || status === "streaming";
  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  useEffect(
    () => () => {
      onBusyChange?.(false);
    },
    [onBusyChange],
  );

  const lastMessage = messages[messages.length - 1];
  const showThinking =
    isBusy &&
    (!lastMessage ||
      lastMessage.role !== "assistant" ||
      !hasRenderedText(lastMessage));

  return (
    <div className={cn("flex size-full min-h-0 flex-col", className)}>
      <MessageScrollerProvider autoScroll defaultScrollPosition="end">
        <MessageScroller className="flex-1">
          <MessageScrollerViewport className="px-4">
            <MessageScrollerContent className="mx-auto w-full max-w-2xl py-4">
              {messages.length === 0 && emptyState ? (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  {emptyState}
                </div>
              ) : null}

              {messages.map((message) => (
                <MessageScrollerItem key={message.id} messageId={message.id}>
                  {message.role === "user" ? (
                    <UserMessage message={message} />
                  ) : (
                    <AssistantMessage message={message} />
                  )}
                </MessageScrollerItem>
              ))}

              {showThinking ? (
                <MessageScrollerItem messageId="thinking" scrollAnchor>
                  <div className="shimmer w-fit text-sm text-muted-foreground">
                    Thinking…
                  </div>
                </MessageScrollerItem>
              ) : null}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton direction="end" />
        </MessageScroller>
      </MessageScrollerProvider>

      <div className="mx-auto w-full max-w-2xl px-4 pb-4">
        <PromptInput
          attachments={attachments}
          isStreaming={isBusy}
          onAddFiles={addFiles}
          onRemoveAttachment={removeAttachment}
          onStop={() => void stop()}
          onSubmit={submit}
        />
      </div>
    </div>
  );
}
