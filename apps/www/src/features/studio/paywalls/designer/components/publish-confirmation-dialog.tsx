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
import { QRCodeSVG } from "qrcode.react";

interface PublishConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPublishing: boolean;
  draftVersion?: number;
  draftUrl?: string;
  publishedUrl?: string;
}

/**
 * Builds the deep link the Voidhash mobile app opens from its QR scanner.
 * Carries the content-addressed release artifact URL — identical for a draft
 * and its published release — so the scanned preview is byte-for-byte what
 * ships to SDKs.
 */
function buildPaywallPreviewDeepLink(url: string, version?: number): string {
  const versionParam = version === undefined ? "" : `&version=${version}`;
  return `voidhash://paywall-preview?url=${encodeURIComponent(url)}${versionParam}`;
}

function PaywallPreviewQr({ url, version }: { url: string; version?: number }) {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-muted/50 p-3">
      <div className="shrink-0 rounded-sm bg-white p-2">
        <QRCodeSVG size={104} value={buildPaywallPreviewDeepLink(url, version)} />
      </div>
      <div className="space-y-1">
        <p className="text-xs font-medium text-foreground">Preview on your device</p>
        <p className="text-xs text-muted-foreground">
          Scan with the Voidhash app to see this exact version on your phone. Purchases are
          simulated.
        </p>
      </div>
    </div>
  );
}

export function PublishConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  isPublishing,
  draftVersion,
  draftUrl,
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
                <PaywallPreviewQr url={publishedUrl} version={draftVersion} />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  This paywall will be rolled out to all users.
                  {draftVersion !== undefined && (
                    <span className="mt-2 block text-xs text-muted-foreground">
                      Version {draftVersion}
                    </span>
                  )}
                </div>
                {draftUrl && <PaywallPreviewQr url={draftUrl} version={draftVersion} />}
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
