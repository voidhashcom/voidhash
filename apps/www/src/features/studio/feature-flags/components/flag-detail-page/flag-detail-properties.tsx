"use client";

import {
  Button,
  cn,
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
import { type ReactNode, useState } from "react";

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

const formatDate = (date: Date) =>
  date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const formatRollout = (rolloutBps: number) => `${(rolloutBps / 100).toFixed(0)}%`;

/**
 * The box every value sits in, static or interactive, so the whole column
 * shares one height, type scale, weight and inset. The negative margin cancels
 * the horizontal padding a trigger needs for its hover state, which keeps the
 * text on the same axis whether or not the row is clickable.
 */
const VALUE_CLASS_NAME =
  "-ml-2.5 flex h-7 items-center gap-2 px-2.5 font-normal text-foreground text-sm";

function PropertyRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex min-h-8 items-center gap-3">
      <dt className="w-24 shrink-0 text-muted-foreground text-sm">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

/**
 * Static counterpart to a trigger — same box, no interaction. Dimmed a step
 * below the editable rows so what can be changed reads as the brighter text,
 * while staying clear of the still-dimmer property labels.
 */
function PropertyValue({ children }: { children: ReactNode }) {
  return <span className={cn(VALUE_CLASS_NAME, "text-foreground/80")}>{children}</span>;
}

function StatusDot({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", className)} />;
}

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
          className={VALUE_CLASS_NAME}
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
    <section className="space-y-3">
      <h2 className="font-medium text-sm">Properties</h2>

      <dl>
        <PropertyRow label="Status">
          {readOnly ? (
            <PropertyValue>
              <StatusDot className={status.dotClassName} />
              {status.label}
            </PropertyValue>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-label="Change status"
                  className={VALUE_CLASS_NAME}
                  disabled={!isEditable}
                  size="sm"
                  variant="ghost"
                >
                  <StatusDot className={status.dotClassName} />
                  {status.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {([true, false] as const).map((value) => (
                  <DropdownMenuItem key={String(value)} onSelect={() => setEnabled(value)}>
                    <StatusDot
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
            <RolloutEditor
              disabled={!isEditable}
              onChange={setRolloutBps}
              rolloutBps={rolloutBps}
            />
          )}
        </PropertyRow>

        <PropertyRow label="Type">
          <PropertyValue>
            <FlagTypeIndicator flagType={flagType} />
          </PropertyValue>
        </PropertyRow>

        <PropertyRow label="Created">
          <PropertyValue>
            {createdAt ? (
              formatDate(createdAt)
            ) : (
              <span className="text-muted-foreground">Unknown</span>
            )}
          </PropertyValue>
        </PropertyRow>

        <PropertyRow label="Updated">
          <PropertyValue>
            {updatedAt ? (
              formatDate(updatedAt)
            ) : (
              <span className="text-muted-foreground">Unknown</span>
            )}
          </PropertyValue>
        </PropertyRow>

        <PropertyRow label="Version">
          <PropertyValue>v{version}</PropertyValue>
        </PropertyRow>
      </dl>
    </section>
  );
}
