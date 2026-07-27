"use client";

import { Button, Tabs, TabsList, TabsTrigger } from "@voidhash/ui";
import { useParams } from "@tanstack/react-router";
import { XIcon } from "lucide-react";
import { useStore } from "zustand/react";

import { PaywallThumbnailAdminSlot } from "@/features/studio/paywalls/designer/dev-mode/paywall-thumbnail-admin-slot";

import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import type { DevModeTab } from "../state/designer-store-state";
import { setDevModeTab, toggleDevMode } from "../state/actions/dev-mode-actions";
import { PANEL_DIMENSIONS } from "../panels/constants";
import { ActionsInspector } from "./actions-inspector";
import { PresenceInspector } from "./presence-inspector";
import { SnapshotInspector } from "./snapshot-inspector";

const DEV_MODE_TABS: { value: DevModeTab; label: string }[] = [
  { value: "snapshot", label: "Snapshot" },
  { value: "presence", label: "Presence" },
  { value: "actions", label: "Actions" },
];

export function DevModeView() {
  const { id: paywallId } = useParams({ strict: false });
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const activeTab = useStore(store, (state) => state.devMode.activeTab);

  const handleTabChange = (value: string) => {
    dispatch(setDevModeTab)({ tab: value as DevModeTab });
  };

  const handleClose = () => {
    dispatch(toggleDevMode)({});
  };

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-background"
      style={{ top: PANEL_DIMENSIONS.TOP_HEIGHT }}
    >
      <div className="flex items-center justify-between border-border border-b px-4 py-2">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            {DEV_MODE_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <PaywallThumbnailAdminSlot paywallId={paywallId} />
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === "snapshot" && <SnapshotInspector />}
        {activeTab === "presence" && <PresenceInspector />}
        {activeTab === "actions" && <ActionsInspector />}
      </div>
    </div>
  );
}
