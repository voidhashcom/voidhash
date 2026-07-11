"use client";

import { useMutation } from "@tanstack/react-query";
import { useLocation, useParams } from "@tanstack/react-router";
import {
  FeedbackSentiment,
  type FeedbackSentimentValue,
  FeedbackTopicLabels,
  type FeedbackTopicValue,
  FeedbackTopicValues,
} from "@voidhash/lib";
import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@voidhash/ui";
import { Annoyed, Frown, Laugh, type LucideIcon, Smile } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/studio/components/auth-context";
import { submitFeedbackOptions } from "@/features/studio/lib/tanstack-query";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";

/** Sentiment scale rendered as lucide icons, mapped to the ordinal 1–4 value. */
const SENTIMENT_OPTIONS: ReadonlyArray<{
  value: FeedbackSentimentValue;
  label: string;
  Icon: LucideIcon;
}> = [
  { value: FeedbackSentiment.Frown, label: "Very unhappy", Icon: Frown },
  { value: FeedbackSentiment.Annoyed, label: "Unhappy", Icon: Annoyed },
  { value: FeedbackSentiment.Smile, label: "Happy", Icon: Smile },
  { value: FeedbackSentiment.Laugh, label: "Very happy", Icon: Laugh },
];

/**
 * Navbar "Feedback" button. Opens a compact popover (not a modal) with a
 * product-area topic select, a message field, and an optional sentiment. On
 * submit it captures the current user (via `useAuth`), the org/project (resolved
 * from the route params), and the current page path — no extra network calls —
 * and relays them through the `SubmitFeedback` RPC, which persists the row and
 * posts it to Slack.
 */
export function FeedbackButton() {
  const { user } = useAuth();
  const params = useParams({ strict: false }) as {
    organizationSlug?: string;
    projectSlug?: string;
  };
  const pathname = useLocation({ select: (location) => location.pathname });

  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<FeedbackTopicValue | undefined>(undefined);
  const [sentiment, setSentiment] = useState<FeedbackSentimentValue | null>(null);
  const [message, setMessage] = useState("");

  const { mutate, status } = useMutation({
    ...submitFeedbackOptions(),
    onError: () => {
      toast.error("Failed to send feedback. Please try again.");
    },
    onSuccess: () => {
      toast.success("Thanks for your feedback!");
      setMessage("");
      setSentiment(null);
      setTopic(undefined);
      setOpen(false);
    },
  });

  const isPending = status === "pending";
  const trimmedMessage = message.trim();
  const canSubmit = Boolean(topic) && trimmedMessage.length > 0 && !isPending;

  const handleSubmit = () => {
    if (!topic || !trimmedMessage || isPending) {
      return;
    }
    const organization = params.organizationSlug
      ? user.organizations.find((o) => o.slug === params.organizationSlug)
      : undefined;
    const project =
      params.organizationSlug && params.projectSlug
        ? CurrentUser.getProjectBySlugs(user, params.organizationSlug, params.projectSlug)
        : undefined;

    mutate({
      topic,
      message: trimmedMessage,
      sentiment: sentiment ?? undefined,
      organizationId: organization?.id,
      projectId: project?.id ?? undefined,
      pathname,
      userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
    });
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button variant="outline">Feedback</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 overflow-hidden p-0">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="flex flex-col gap-2 p-2">
            <Select
              onValueChange={(value) => setTopic(value as FeedbackTopicValue)}
              value={topic}
            >
              <SelectTrigger className="w-full" id="feedback-topic">
                <SelectValue placeholder="Select a topic…" />
              </SelectTrigger>
              <SelectContent>
                {FeedbackTopicValues.map((value) => (
                  <SelectItem key={value} value={value}>
                    {FeedbackTopicLabels[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Textarea
              autoFocus
              aria-label="Your feedback"
              className="min-h-32 resize-none"
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                // ⌘/Ctrl + Enter submits, matching common feedback widgets.
                if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Your feedback…"
              value={message}
            />
          </div>

          <div className="flex items-center justify-between border-t px-2 py-2">
            <div className="flex items-center gap-0.5">
              {SENTIMENT_OPTIONS.map(({ value, label, Icon }) => {
                const active = sentiment === value;
                return (
                  <button
                    aria-label={label}
                    aria-pressed={active}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                      active && "bg-accent text-foreground",
                    )}
                    key={value}
                    onClick={() => setSentiment(active ? null : value)}
                    title={label}
                    type="button"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                );
              })}
            </div>

            <Button disabled={!canSubmit} size="sm" type="submit">
              {isPending ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}
