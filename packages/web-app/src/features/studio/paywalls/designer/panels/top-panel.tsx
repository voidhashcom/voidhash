"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "@tanstack/react-router";
import { INTERNAL_FEATURE_FLAGS } from "@voidhash/rpc";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Logo,
} from "@voidhash/ui";
import {
  ChevronDownIcon,
  CodeIcon,
  Loader2Icon,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useStore } from "zustand/react";

import { env } from "@/features/studio/lib/env";
import {
  createPaywallReleaseOptions,
  publishPaywallReleaseOptions,
} from "@/features/studio/lib/tanstack-query/paywalls";
import { queryKeys } from "@/features/studio/lib/tanstack-query/query-keys";
import { useInternalFeatureFlag } from "@/features/studio/lib/useInternalFeatureFlag";

import { ModeToggle } from "../components/ui/mode-toggle";
import { PublishConfirmationDialog } from "../components/publish-confirmation-dialog";
import { toggleAiPanel } from "../state/actions/ai-panel-actions";
import { toggleDevMode } from "../state/actions/dev-mode-actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import { PANEL_DIMENSIONS } from "./constants";

const isDevelopment = env.VITE_APP_ENV === "development";

/**
 * Subtle connection indicator shown while the transport is disconnected
 * post-ready (reconnect loop running). Reflects unsaved local edits while
 * offline via the document's pending-transaction count.
 */
function ConnectionStatusPill() {
  const store = usePaywallDesignerStore();
  const isConnected = useStore(store, (state) => state.mimic.isConnected);
  const hasPendingChanges = useStore(store, (state) => state.mimic.pendingCount > 0);

  if (isConnected) {
    return null;
  }
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {hasPendingChanges ? "Offline — changes pending" : "Reconnecting…"}
    </span>
  );
}

export function TopPanel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    organizationSlug,
    projectSlug,
    id: paywallId,
  } = useParams({
    strict: false,
  });

  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const devModeEnabled = useStore(store, (state) => state.devMode.enabled);
  const aiPanelOpen = useStore(store, (state) => state.ai.panelOpen);
  const aiEnabled = useInternalFeatureFlag(INTERNAL_FEATURE_FLAGS.voidhashAiPi.key);

  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState<
    | {
        releaseId: string;
        version: number;
        draftUrl: string;
      }
    | undefined
  >();
  const [publishedUrl, setPublishedUrl] = useState<string | undefined>();

  const { mutate: createRelease, isPending: isCreatingRelease } = useMutation({
    ...createPaywallReleaseOptions(),
    onSuccess: (data) => {
      setReleaseInfo({
        releaseId: data.releaseId,
        version: data.version,
        draftUrl: data.draftUrl,
      });
      setShowPublishDialog(true);
    },
    onError: () => {
      toast.error("Failed to create release");
    },
  });

  const { mutate: publishRelease, isPending: isPublishing } = useMutation({
    ...publishPaywallReleaseOptions(),
    onSuccess: (data) => {
      toast.success("Paywall published successfully");
      setPublishedUrl(data.htmlUrl);
      // Invalidate draft release query so UI reflects the published state
      if (paywallId) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.paywall.draft({ paywallId }),
        });
      }
    },
    onError: () => {
      toast.error("Failed to publish paywall");
      setShowPublishDialog(false);
      setReleaseInfo(undefined);
      setPublishedUrl(undefined);
    },
  });

  const handleGoToDashboard = () => {
    void navigate({
      params: {
        organizationSlug: organizationSlug ?? "",
        projectSlug: projectSlug ?? "",
      },
      to: "/studio/$organizationSlug/$projectSlug/paywalls",
    });
  };

  const handlePublishClick = () => {
    if (!paywallId) return;
    setPublishedUrl(undefined);
    createRelease({ paywallId });
  };

  const handleDialogClose = (open: boolean) => {
    setShowPublishDialog(open);
    if (!open) {
      setReleaseInfo(undefined);
      setPublishedUrl(undefined);
    }
  };

  const handleConfirmPublish = () => {
    if (!releaseInfo) return;
    publishRelease({ releaseId: releaseInfo.releaseId });
  };

  const handleDevModeToggle = () => {
    dispatch(toggleDevMode)({});
  };

  const handleAiPanelToggle = () => {
    dispatch(toggleAiPanel)({});
  };

  return (
    <>
      <div
        className="fixed top-0 right-0 left-0 z-50 flex items-center justify-between border-sidebar-border border-b bg-background px-3"
        style={{ height: PANEL_DIMENSIONS.TOP_HEIGHT }}
      >
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm">
          <div className="pointer-events-auto">Test Paywall</div>
          <ConnectionStatusPill />
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center rounded-lg px-2 py-3 hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50"
                type="button"
              >
                <Logo variant="symbol" />
                <ChevronDownIcon className="ml-2 size-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onSelect={handleGoToDashboard}>Go to dashboard</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {aiEnabled && (
            <Button size="icon" variant="ghost" className="relative" onClick={handleAiPanelToggle}>
              {aiPanelOpen ? (
                <PanelLeftClose className=" size-4" />
              ) : (
                <PanelLeftOpen className=" size-4" />
              )}
            </Button>
          )}
          <ModeToggle />
        </div>
        <div className="flex items-center gap-2">
          {isDevelopment && (
            <Button
              size="sm"
              variant={devModeEnabled ? "default" : "ghost"}
              onClick={handleDevModeToggle}
            >
              <CodeIcon className="mr-1 size-4" />
              Dev
            </Button>
          )}
          <Button size="sm" variant="outline">
            Share
          </Button>
          <Button size="sm" onClick={handlePublishClick} disabled={isCreatingRelease || !paywallId}>
            {isCreatingRelease ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Creating release...
              </>
            ) : (
              "Publish"
            )}
          </Button>
        </div>
      </div>
      <PublishConfirmationDialog
        open={showPublishDialog}
        onOpenChange={handleDialogClose}
        onConfirm={handleConfirmPublish}
        isPublishing={isPublishing}
        draftVersion={releaseInfo?.version}
        draftUrl={releaseInfo?.draftUrl}
        publishedUrl={publishedUrl}
      />
    </>
  );
}
