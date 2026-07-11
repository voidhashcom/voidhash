"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@voidhash/ui";
import { CheckCircle2Icon, ExternalLinkIcon, Loader2Icon } from "lucide-react";

interface PublishConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPublishing: boolean;
  draftVersion?: number;
  publishedUrl?: string;
}

export function PublishConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  isPublishing,
  draftVersion,
  publishedUrl,
}: PublishConfirmationDialogProps) {
  const isPublished = !!publishedUrl;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isPublished ? "Paywall Published" : "Publish Paywall"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            {isPublished ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle2Icon className="size-5" />
                  <span>Version {draftVersion} is now live!</span>
                </div>
                <div className="rounded-md border bg-muted/50 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">Preview URL</p>
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <span className="truncate">{publishedUrl}</span>
                    <ExternalLinkIcon className="size-3 shrink-0" />
                  </a>
                </div>
              </div>
            ) : (
              <div>
                This paywall will be rolled out to all users.
                {draftVersion !== undefined && (
                  <span className="mt-2 block text-xs text-muted-foreground">
                    Version {draftVersion}
                  </span>
                )}
              </div>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {isPublished ? (
            <AlertDialogAction onClick={() => onOpenChange(false)}>Done</AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel disabled={isPublishing}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirm} disabled={isPublishing}>
                {isPublishing ? (
                  <>
                    <Loader2Icon className="mr-2 size-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  "Publish"
                )}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
