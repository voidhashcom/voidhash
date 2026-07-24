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
import { Archive, CirclePause, CirclePlay, FilePenLine, FlaskConical, Trophy } from "lucide-react";

import { CreateExperimentModal } from "./create-experiment-modal";

type ExperimentEmptyTab = "all" | "draft" | "running" | "paused" | "concluded" | "archived";

interface ExperimentsPageEmptyStateProps {
  projectId: string;
  tab: ExperimentEmptyTab;
}

const EMPTY_TAB_CONTENT = {
  all: {
    description:
      "Compare variants against a measurable goal, split traffic consistently, and learn which experience performs best.",
    icon: FlaskConical,
    title: "Run your first A/B test",
  },
  draft: {
    description:
      "Drafts let you define variants, treatments, and success metrics before any traffic is assigned.",
    icon: FilePenLine,
    title: "No draft tests",
  },
  running: {
    description:
      "Tests appear here while they are actively assigning variants and collecting results.",
    icon: CirclePlay,
    title: "No tests running",
  },
  paused: {
    description: "Paused tests keep their setup and results without assigning any new traffic.",
    icon: CirclePause,
    title: "No paused tests",
  },
  concluded: {
    description: "Completed tests and their selected winning variants will be kept here.",
    icon: Trophy,
    title: "No concluded tests",
  },
  archived: {
    description: "Archived tests are removed from day-to-day work but remain available to restore.",
    icon: Archive,
    title: "Nothing archived",
  },
} as const satisfies Record<
  ExperimentEmptyTab,
  { description: string; icon: typeof FlaskConical; title: string }
>;

/** Empty state for the A/B test list, tailored to the selected lifecycle status. */
export function ExperimentsPageEmptyState({ projectId, tab }: ExperimentsPageEmptyStateProps) {
  const { description, icon: Icon, title } = EMPTY_TAB_CONTENT[tab];
  const showCreateAction = tab === "all" || tab === "draft";

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
          <CreateExperimentModal projectId={projectId} trigger={<Button>Create A/B test</Button>} />
        </EmptyContent>
      ) : null}
    </Empty>
  );
}
