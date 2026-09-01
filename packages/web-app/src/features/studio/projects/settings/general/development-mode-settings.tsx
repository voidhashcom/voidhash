"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Switch } from "@voidhash/ui";
import { toast } from "sonner";

import {
  getDevelopmentModeSettingsOptions,
  resetDevelopmentDataOptions,
  setDevelopmentPurchasesEnabledOptions,
} from "@/features/studio/lib/tanstack-query";
import { SettingsCard, SettingsRow, SettingsSection } from "@/features/studio/settings";

export function DevelopmentModeSettings({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const settings = useQuery(getDevelopmentModeSettingsOptions(projectId));
  const enabledMutation = useMutation({
    ...setDevelopmentPurchasesEnabledOptions(),
    onSuccess: () => {
      toast.success("Development purchase settings updated");
      void queryClient.invalidateQueries({ queryKey: ["development-mode"] });
    },
  });
  const resetMutation = useMutation({
    ...resetDevelopmentDataOptions(),
    onSuccess: () => {
      toast.success("Development purchase data reset");
      void queryClient.invalidateQueries({ queryKey: ["development-mode"] });
    },
  });

  return (
    <SettingsSection title="Development purchases">
      <SettingsCard>
        <SettingsRow
          control={
            <Switch
              checked={settings.data?.isDevelopmentPurchasesEnabled ?? false}
              disabled={settings.isPending || enabledMutation.isPending}
              onCheckedChange={(enabled) => enabledMutation.mutate({ enabled, projectId })}
            />
          }
          description="Allow debug SDK builds to create isolated test purchases."
          title="Enable development purchases"
        />
        <SettingsRow
          control={
            <Button
              disabled={resetMutation.isPending}
              size="sm"
              variant="destructive"
              onClick={() => {
                if (
                  window.confirm(
                    "Delete every development purchase, subscription, grant, transaction, and purchase-ledger record for this project?",
                  )
                ) {
                  resetMutation.mutate({ projectId });
                }
              }}
            >
              {resetMutation.isPending ? "Resetting…" : "Reset development data"}
            </Button>
          }
          description="Production and sandbox purchase data are never affected."
          title="Reset test data"
        />
      </SettingsCard>
    </SettingsSection>
  );
}
