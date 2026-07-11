"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
} from "@voidhash/ui";
import { Loader2Icon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { queryKeys, setActivePaywallReleaseOptions } from "@/features/studio/lib/tanstack-query";

interface ActivatePaywallReleaseButtonProps {
  paywallSlug: string;
  projectId: string;
  releaseId: string;
  version: number | null;
}

/**
 * Rollback affordance for a code-deployed paywall release: a confirm dialog
 * that calls `SetActivePaywallRelease` and refreshes the deploy + location
 * queries so active-state badges update everywhere.
 */
export function ActivatePaywallReleaseButton({
  paywallSlug,
  projectId,
  releaseId,
  version,
}: ActivatePaywallReleaseButtonProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { mutate: activateRelease, status } = useMutation({
    ...setActivePaywallReleaseOptions(),
    onError: (error) => {
      toast.error(
        error._tag === "EffectQueryFailure"
          ? error.match({
              "Rpc/PaywallDeployValidationError": (f) => f.message,
              "Rpc/ActionForbiddenError": (f) => f.message,
              "Rpc/ReleaseNotFoundError": () => `Release not found`,
              OrElse: () => "Failed to activate release",
            })
          : "Failed to activate release",
      );
    },
    onSuccess: async () => {
      toast.success(
        version === null
          ? `Activated release for "${paywallSlug}"`
          : `Activated "${paywallSlug}" v${version}`,
      );
      await queryClient.invalidateQueries({
        queryKey: queryKeys.paywallDeploy.list({ projectId }),
      });
      await queryClient.invalidateQueries({
        queryKey: queryKeys.paywallLocation.all,
      });
      setOpen(false);
    },
  });

  const isActivating = status === "pending";
  const versionLabel = version === null ? "this release" : `v${version}`;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Activate
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Activate release</AlertDialogTitle>
          <AlertDialogDescription>
            Make {versionLabel} of paywall <span className="font-mono">{paywallSlug}</span> the
            active release. Any currently active release for this paywall will be replaced.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isActivating}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isActivating}
            onClick={(event) => {
              // Keep the dialog open while the mutation runs; onSuccess closes it.
              event.preventDefault();
              activateRelease({ releaseId });
            }}
          >
            {isActivating ? (
              <>
                <Loader2Icon className="mr-2 size-4 animate-spin" />
                Activating...
              </>
            ) : (
              "Activate"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
