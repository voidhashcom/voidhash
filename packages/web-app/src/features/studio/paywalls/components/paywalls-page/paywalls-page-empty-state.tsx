"use client";

import { Button } from "@voidhash/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@voidhash/ui/empty";
import { Archive, CirclePause, LayoutTemplate } from "lucide-react";
import { useState } from "react";

import { CreatePaywallModal } from "./create-paywall-modal";

type PaywallEmptyTab = "all" | "active" | "inactive" | "archived";

interface PaywallsPageEmptyStateProps {
  projectId: string;
  tab: PaywallEmptyTab;
}

const EMPTY_TAB_CONTENT = {
  all: {
    icon: LayoutTemplate,
    title: "Design your first paywall",
    description:
      "Paywalls are the screens people see when they hit a purchase. Build one in the designer, then publish it to a location in your app.",
  },
  active: {
    icon: LayoutTemplate,
    title: "No paywalls live",
    description:
      "Nothing is serving right now. Create a paywall to start converting, or check the archived tab for ones you retired.",
  },
  inactive: {
    icon: CirclePause,
    title: "No inactive paywalls",
    description: "Paywalls move between live and archived today, so nothing lands here yet.",
  },
  archived: {
    icon: Archive,
    title: "Nothing archived",
    description:
      "Paywalls you archive are kept here. They stop serving but stay editable, and you can restore them at any time.",
  },
} as const satisfies Record<
  PaywallEmptyTab,
  { icon: typeof LayoutTemplate; title: string; description: string }
>;

/** Empty state for the paywalls list, tailored to the tab the user is browsing. */
export function PaywallsPageEmptyState({ projectId, tab }: PaywallsPageEmptyStateProps) {
  const [open, setOpen] = useState(false);
  const { icon: Icon, title, description } = EMPTY_TAB_CONTENT[tab];
  const showCreateAction = tab === "all" || tab === "active";

  return (
    <Empty className="mx-auto w-full max-w-xl">
      <EmptyMedia variant="icon">
        <Icon />
      </EmptyMedia>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {showCreateAction ? (
        <EmptyContent>
          <CreatePaywallModal
            onClose={() => setOpen(false)}
            onSuccess={() => setOpen(false)}
            open={open}
            projectId={projectId}
            trigger={<Button onClick={() => setOpen(true)}>Create paywall</Button>}
          />
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
