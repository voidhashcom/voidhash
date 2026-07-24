"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Slider,
} from "@voidhash/ui";
import { CheckIcon } from "lucide-react";
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

import type { FlagType } from "../../lib/flag-type";
import { FlagTypeIndicator } from "../shared/flag-type-indicator";
import { useFlagDraft } from "./flag-draft-context";

interface FlagDetailPropertiesProps {
  archivedAt: Date | null;
  createdAt: Date | null;
  flagType: FlagType;
  updatedAt: Date | null;
  version: number;
}

const STATUS_PRESENTATION = {
  archived: { dotClassName: "bg-muted-foreground", label: "Archived" },
  disabled: { dotClassName: "bg-muted-foreground/50", label: "Disabled" },
  enabled: { dotClassName: "bg-emerald-500", label: "Enabled" },
} as const;

const formatRollout = (rolloutBps: number) => `${(rolloutBps / 100).toFixed(0)}%`;

function RolloutEditor({
  disabled,
  onChange,
  rolloutBps,
}: {
  disabled?: boolean;
  onChange: (rolloutBps: number) => void;
  rolloutBps: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label="Change rollout"
          className={PROPERTY_VALUE_CLASS_NAME}
          disabled={disabled}
          size="sm"
          variant="ghost"
        >
          {formatRollout(rolloutBps)} of users
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs">Rollout</span>
          <div className="flex items-center gap-1">
            <Input
              aria-label="Rollout percentage"
              className="h-7 w-16 text-right"
              max={100}
              min={0}
              onChange={(event) => {
                const percent = Number(event.target.value);
                if (!Number.isFinite(percent)) {
                  return;
                }
                onChange(Math.round(Math.min(100, Math.max(0, percent)) * 100));
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              type="number"
              value={rolloutBps / 100}
            />
            <span className="text-muted-foreground text-sm">%</span>
          </div>
        </div>
        <Slider
          max={10000}
          min={0}
          onValueChange={([value]) => onChange(value ?? 0)}
          step={100}
          value={[rolloutBps]}
        />
        <p className="text-muted-foreground text-xs">
          Share of users the flag turns on for. Overrides and allow lists are applied first.
        </p>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Right-hand property list for the feature-flag detail screen. Status and
 * rollout are edited in place through a dropdown and a popover, staged into the
 * draft; the remaining rows are immutable facts about the flag.
 */
export function FlagDetailProperties({
  archivedAt,
  createdAt,
  flagType,
  updatedAt,
  version,
}: FlagDetailPropertiesProps) {
  const { enabled, isSaving, readOnly, rolloutBps, setEnabled, setRolloutBps, variants } =
    useFlagDraft();

  const status = archivedAt
    ? STATUS_PRESENTATION.archived
    : enabled
      ? STATUS_PRESENTATION.enabled
      : STATUS_PRESENTATION.disabled;
  const isEditable = !readOnly && !isSaving;

  return (
    <PropertyList>
      <PropertyRow label="Status">
        {readOnly ? (
          <PropertyValue>
            <PropertyStatusDot className={status.dotClassName} />
            {status.label}
          </PropertyValue>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Change status"
                className={PROPERTY_VALUE_CLASS_NAME}
                disabled={!isEditable}
                size="sm"
                variant="ghost"
              >
                <PropertyStatusDot className={status.dotClassName} />
                {status.label}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {([true, false] as const).map((value) => (
                <DropdownMenuItem key={String(value)} onSelect={() => setEnabled(value)}>
                  <PropertyStatusDot
                    className={
                      value
                        ? STATUS_PRESENTATION.enabled.dotClassName
                        : STATUS_PRESENTATION.disabled.dotClassName
                    }
                  />
                  {value ? STATUS_PRESENTATION.enabled.label : STATUS_PRESENTATION.disabled.label}
                  {value === enabled && <CheckIcon className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </PropertyRow>

      <PropertyRow label="Allocation">
        {flagType !== "boolean" ? (
          <PropertyValue>{`${variants.length} variant${variants.length === 1 ? "" : "s"}`}</PropertyValue>
        ) : readOnly ? (
          <PropertyValue>{`${formatRollout(rolloutBps)} of users`}</PropertyValue>
        ) : (
          <RolloutEditor disabled={!isEditable} onChange={setRolloutBps} rolloutBps={rolloutBps} />
        )}
      </PropertyRow>

      <PropertyRow label="Type">
        <PropertyValue>
          <FlagTypeIndicator flagType={flagType} />
        </PropertyValue>
      </PropertyRow>

      <PropertyRow label="Created">
        <PropertyValue>
          {createdAt ? formatPropertyDate(createdAt) : <PropertyEmpty>Unknown</PropertyEmpty>}
        </PropertyValue>
      </PropertyRow>

      <PropertyRow label="Updated">
        <PropertyValue>
          {updatedAt ? formatPropertyDate(updatedAt) : <PropertyEmpty>Unknown</PropertyEmpty>}
        </PropertyValue>
      </PropertyRow>

      <PropertyRow label="Version">
        <PropertyValue>v{version}</PropertyValue>
      </PropertyRow>
    </PropertyList>
  );
}
