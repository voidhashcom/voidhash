"use client";

import { Button, Input, Popover, PopoverContent, PopoverTrigger } from "@voidhash/ui";
import { useState } from "react";

import {
  formatPropertyDate,
  PROPERTY_VALUE_CLASS_NAME,
  PropertyEmpty,
  PropertyList,
  PropertyRow,
  PropertyStatusDot,
  PropertyValue,
} from "@/features/studio/components/property-list";

import { EXPERIMENT_STATUS, experimentStatusLabel } from "../../lib/experiment-status";
import { parseEventNames, useExperimentDraft } from "./experiment-draft-context";

const STATUS_DOTS: Record<number, string> = {
  [EXPERIMENT_STATUS.draft]: "bg-muted-foreground/50",
  [EXPERIMENT_STATUS.running]: "bg-emerald-500",
  [EXPERIMENT_STATUS.paused]: "bg-amber-500",
  [EXPERIMENT_STATUS.concluded]: "bg-sky-500",
};

/**
 * A metric event edited in place through a popover, styled to sit in the
 * property column like every other value. Edits stage into the draft; the
 * bottom action bar saves them.
 */
function MetricEditor({
  ariaLabel,
  disabled,
  displayValue,
  hint,
  onChange,
  placeholder,
  value,
}: {
  ariaLabel: string;
  disabled: boolean;
  displayValue: string | null;
  hint: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={ariaLabel}
          className={PROPERTY_VALUE_CLASS_NAME}
          disabled={disabled}
          size="sm"
          variant="ghost"
        >
          {displayValue ? (
            <span className="min-w-0 truncate font-mono text-xs">{displayValue}</span>
          ) : (
            <PropertyEmpty>Not set</PropertyEmpty>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-2 p-3">
        <Input
          aria-label={ariaLabel}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          value={value}
        />
        <p className="text-muted-foreground text-xs">{hint}</p>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Right-hand property list for the A/B-test detail screen. The goal and
 * secondary metric events are edited in place through popovers (staged into
 * the draft, frozen once the test leaves draft so results stay comparable);
 * the remaining rows are immutable facts about the test.
 */
export function ExperimentDetailProperties() {
  const {
    experiment,
    locationIds,
    metricsLocked,
    primaryMetric,
    secondaryMetrics,
    setPrimaryMetric,
    setSecondaryMetrics,
    variants,
  } = useExperimentDraft();

  const isArchived = experiment.archivedAt != null;
  const status = isArchived
    ? { dotClassName: "bg-muted-foreground", label: "Archived" }
    : {
        dotClassName: STATUS_DOTS[experiment.status] ?? "bg-muted-foreground/50",
        label: experimentStatusLabel(experiment.status),
      };
  const secondaryList = parseEventNames(secondaryMetrics);

  return (
    <PropertyList>
      <PropertyRow label="Status">
        <PropertyValue>
          <PropertyStatusDot className={status.dotClassName} />
          {status.label}
        </PropertyValue>
      </PropertyRow>

      <PropertyRow label="Variants">
        <PropertyValue>{`${variants.length} variant${variants.length === 1 ? "" : "s"}`}</PropertyValue>
      </PropertyRow>

      <PropertyRow label="Locations">
        <PropertyValue>
          {locationIds.length > 0 ? (
            `${locationIds.length} location${locationIds.length === 1 ? "" : "s"}`
          ) : (
            <PropertyEmpty>None yet</PropertyEmpty>
          )}
        </PropertyValue>
      </PropertyRow>

      <PropertyRow label="Goal event">
        {metricsLocked ? (
          <PropertyValue>
            {primaryMetric ? (
              <span className="font-mono text-xs">{primaryMetric}</span>
            ) : (
              <PropertyEmpty>Not set</PropertyEmpty>
            )}
          </PropertyValue>
        ) : (
          <MetricEditor
            ariaLabel="Goal event"
            disabled={metricsLocked}
            displayValue={primaryMetric || null}
            hint="The event that counts as success. Left empty, purchases are used. Locked once the test starts."
            onChange={setPrimaryMetric}
            placeholder="purchase_completed"
            value={primaryMetric}
          />
        )}
      </PropertyRow>

      <PropertyRow label="Secondary">
        {metricsLocked ? (
          <PropertyValue>
            {secondaryList.length > 0 ? (
              <span className="min-w-0 truncate font-mono text-xs">{secondaryList.join(", ")}</span>
            ) : (
              <PropertyEmpty>None</PropertyEmpty>
            )}
          </PropertyValue>
        ) : (
          <MetricEditor
            ariaLabel="Secondary events"
            disabled={metricsLocked}
            displayValue={secondaryList.length > 0 ? secondaryList.join(", ") : null}
            hint="Extra events to track alongside the goal, comma separated."
            onChange={setSecondaryMetrics}
            placeholder="trial_started, paywall_viewed"
            value={secondaryMetrics}
          />
        )}
      </PropertyRow>

      <PropertyRow label="Started">
        <PropertyValue>
          {experiment.startedAt ? (
            formatPropertyDate(experiment.startedAt)
          ) : (
            <PropertyEmpty>Not yet</PropertyEmpty>
          )}
        </PropertyValue>
      </PropertyRow>

      <PropertyRow label="Ended">
        <PropertyValue>
          {experiment.endedAt ? (
            formatPropertyDate(experiment.endedAt)
          ) : (
            <PropertyEmpty>Not yet</PropertyEmpty>
          )}
        </PropertyValue>
      </PropertyRow>

      <PropertyRow label="Created">
        <PropertyValue>
          {experiment.createdAt ? (
            formatPropertyDate(experiment.createdAt)
          ) : (
            <PropertyEmpty>Unknown</PropertyEmpty>
          )}
        </PropertyValue>
      </PropertyRow>

      <PropertyRow label="Version">
        <PropertyValue>v{experiment.version}</PropertyValue>
      </PropertyRow>
    </PropertyList>
  );
}
