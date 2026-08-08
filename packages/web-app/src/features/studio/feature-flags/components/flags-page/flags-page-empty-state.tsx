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
import { Archive, CircleOff, Flag, ToggleRight } from "lucide-react";

import { CreateFlagModal } from "./create-flag-modal";

type FlagEmptyTab = "all" | "enabled" | "disabled" | "archived";

interface FlagsPageEmptyStateProps {
  projectId: string;
  tab: FlagEmptyTab;
}

const EMPTY_TAB_CONTENT = {
  all: {
    description:
      "Release safely, roll changes out in stages, and target the right people without shipping another app build.",
    icon: Flag,
    title: "Create your first feature flag",
  },
  enabled: {
    description:
      "No flags are serving changes right now. Enable a flag when its rollout is ready for users.",
    icon: ToggleRight,
    title: "No flags enabled",
  },
  disabled: {
    description:
      "Disabled flags stay configured but always evaluate to their off state. New flags will appear here.",
    icon: CircleOff,
    title: "No disabled flags",
  },
  archived: {
    description:
      "Flags you archive are kept here. They stop evaluating for users and can be restored at any time.",
    icon: Archive,
    title: "Nothing archived",
  },
} as const satisfies Record<
  FlagEmptyTab,
  { description: string; icon: typeof Flag; title: string }
>;

/** Empty state for the feature flag list, tailored to the selected status. */
export function FlagsPageEmptyState({ projectId, tab }: FlagsPageEmptyStateProps) {
  const { description, icon: Icon, title } = EMPTY_TAB_CONTENT[tab];
  const showCreateAction = tab === "all" || tab === "disabled";

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
          <CreateFlagModal projectId={projectId} trigger={<Button>Create feature flag</Button>} />
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
