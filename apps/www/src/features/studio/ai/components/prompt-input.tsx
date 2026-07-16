import {
  Attachment,
  AttachmentActions,
  AttachmentAction,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  Button,
  cn,
  Spinner,
  Textarea,
} from "@voidhash/ui";
import { ArrowUp, FileText, Paperclip, Square, X } from "lucide-react";
import { useRef, useState } from "react";

import { ATTACHMENT_ACCEPT, formatBytes, type PendingAttachment } from "../attachments";

interface PromptInputProps {
  /** Whether the assistant is currently generating (shows stop; sends become steering). */
  isStreaming: boolean;
  /** Submit the trimmed prompt text (attachments are composed in by the host). */
  onSubmit: (text: string) => void;
  /** Abort the in-flight generation. */
  onStop: () => void;
  /** Attachments queued for the next message. */
  attachments: ReadonlyArray<PendingAttachment>;
  /** Add files picked from the file dialog (or pasted/dropped). */
  onAddFiles: (files: File[]) => void;
  /** Remove a queued attachment by id. */
  onRemoveAttachment: (id: string) => void;
  className?: string;
}

const attachmentState = (status: PendingAttachment["status"]) =>
  status === "ready" ? "done" : status;

/**
 * Bottom composer for the chat shell: queued-attachment chips, an autosizing-ish
 * textarea, an attach button, and a send button. Enter submits; Shift+Enter
 * inserts a newline. While streaming, stop and send remain available so a new
 * message can steer the active Pi run.
 * Send is disabled until every attachment has finished uploading, and requires
 * either some text or at least one ready attachment.
 */
export function PromptInput({
  isStreaming,
  onSubmit,
  onStop,
  attachments,
  onAddFiles,
  onRemoveAttachment,
  className,
}: PromptInputProps) {
  const [value, setValue] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmed = value.trim();
  const isUploading = attachments.some((attachment) => attachment.status === "uploading");
  const hasReadyAttachment = attachments.some((attachment) => attachment.status === "ready");
  const canSend = !isUploading && (trimmed.length > 0 || hasReadyAttachment);

  const submit = () => {
    if (!canSend) {
      return;
    }
    onSubmit(trimmed);
    setValue("");
  };

  const pickFiles = (fileList: FileList | null) => {
    if (fileList && fileList.length > 0) {
      onAddFiles(Array.from(fileList));
    }
  };

  return (
    <form
      className={cn("flex flex-col gap-2 rounded-xl border border-border bg-card p-2", className)}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {attachments.length > 0 ? (
        <AttachmentGroup className="px-1">
          {attachments.map((attachment) => (
            <Attachment key={attachment.id} size="sm" state={attachmentState(attachment.status)}>
              <AttachmentMedia variant={attachment.kind === "image" ? "image" : "icon"}>
                {attachment.status === "uploading" ? (
                  <Spinner />
                ) : attachment.kind === "image" && (attachment.previewUrl ?? attachment.url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={attachment.name} src={attachment.previewUrl ?? attachment.url} />
                ) : (
                  <FileText />
                )}
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{attachment.name}</AttachmentTitle>
                <AttachmentDescription>
                  {attachment.status === "error"
                    ? (attachment.error ?? "Upload failed")
                    : formatBytes(attachment.sizeBytes)}
                </AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction
                  aria-label={`Remove ${attachment.name}`}
                  onClick={() => onRemoveAttachment(attachment.id)}
                  type="button"
                >
                  <X />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          ))}
        </AttachmentGroup>
      ) : null}

      <Textarea
        aria-label="Message"
        autoFocus
        className="max-h-48 min-h-0 resize-none border-0 bg-transparent px-1 py-1.5 shadow-none focus-visible:ring-0"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        placeholder="Ask anything…"
        rows={3}
        value={value}
      />

      <div className="flex items-center gap-2">
        <input
          accept={ATTACHMENT_ACCEPT}
          className="hidden"
          multiple
          onChange={(event) => {
            pickFiles(event.target.files);
            // Reset so selecting the same file again re-fires change.
            event.target.value = "";
          }}
          ref={fileInputRef}
          type="file"
        />
        <Button
          aria-label="Attach files"
          onClick={() => fileInputRef.current?.click()}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <Paperclip className="size-4" />
        </Button>
        {isStreaming ? (
          <Button
            aria-label="Stop"
            className="ml-auto"
            onClick={onStop}
            size="icon-sm"
            type="button"
            variant="secondary"
          >
            <Square className="size-3.5" />
          </Button>
        ) : null}
        <Button
          aria-label={isStreaming ? "Steer" : "Send"}
          className={isStreaming ? undefined : "ml-auto"}
          disabled={!canSend}
          size="icon-sm"
          type="submit"
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
    </form>
  );
}
