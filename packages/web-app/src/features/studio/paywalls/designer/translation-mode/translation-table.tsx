"use client";

import { useParams } from "@tanstack/react-router";
import {
  Badge,
  cn,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@voidhash/ui";
import { ImageIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "@/features/studio/components/auth-context";
import { CurrentUser } from "@/features/studio/lib/utils/current-user";
import { AssetPickerDialog } from "@/features/studio/paywall-assets/asset-picker-dialog";

import {
  updateComponentPropLocalizedValue,
  updateNodeLocalizedImage,
  updateNodeTranslation,
} from "../state/actions";
import { usePaywallDesignerActions } from "../state/designer-store";
import { localeLabel } from "../utils/locale-display";
import type {
  TranslationKindFilter,
  TranslationRow,
  TranslationScreenGroup,
} from "./build-translation-rows";
import type { TranslationFilterState } from "./translation-mode-workspace";

interface TranslationTableProps {
  groups: readonly TranslationScreenGroup[];
  screens: readonly { id: string; name: string }[];
  targetLocale: string;
  defaultLocale: string;
  filter: TranslationFilterState;
  onFilterChange: (filter: TranslationFilterState) => void;
  selectedKey: string | null;
  onSelectRow: (key: string) => void;
}

const KIND_OPTIONS: readonly { value: TranslationKindFilter; label: string }[] = [
  { label: "All kinds", value: "all" },
  { label: "Texts", value: "text" },
  { label: "Images", value: "image" },
  { label: "Component props", value: "componentProp" },
];

const KIND_BADGE: Record<TranslationRow["kind"], string> = {
  componentProp: "Prop",
  image: "Image",
  text: "Text",
};

/** Resolves the current organization id from the route + session (asset picker scope). */
function useOrganizationId(): string | null {
  const { organizationSlug, projectSlug } = useParams({ strict: false });
  const { user } = useAuth();
  return useMemo(() => {
    if (!organizationSlug || !projectSlug) return null;
    return (
      CurrentUser.getProjectBySlugs(user, organizationSlug, projectSlug)?.organizationId ?? null
    );
  }, [user, organizationSlug, projectSlug]);
}

/**
 * Inline translation text cell: drafts locally, commits on blur or Enter
 * (Shift+Enter inserts a newline), Escape reverts. An empty commit clears the
 * override — the cell then shows the base value dimmed via the placeholder.
 * External override changes resync the draft unless the cell is focused.
 */
function TranslationTextCell({
  base,
  override,
  onCommit,
}: {
  base: string;
  override: string | null;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(override ?? "");
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) {
      setDraft(override ?? "");
    }
  }, [override]);

  const commit = () => {
    if (draft !== (override ?? "")) {
      onCommit(draft);
    }
  };

  return (
    <Textarea
      className="min-h-8 resize-none border-transparent bg-transparent px-2 py-1.5 text-sm shadow-none hover:border-input focus-visible:border-input dark:bg-transparent"
      onBlur={() => {
        focusedRef.current = false;
        commit();
      }}
      onChange={(event) => setDraft(event.target.value)}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          setDraft(override ?? "");
        }
      }}
      placeholder={base}
      rows={1}
      value={draft}
    />
  );
}

/**
 * Image override cell: a thumbnail of the effective URL (dimmed while falling
 * back to base) that opens the organization asset picker; picking an asset
 * writes the localized image, the X affordance clears the override.
 */
function TranslationImageCell({
  baseUrl,
  overrideUrl,
  onPick,
  onClear,
}: {
  baseUrl: string;
  overrideUrl: string | null;
  onPick: (url: string) => void;
  onClear: () => void;
}) {
  const organizationId = useOrganizationId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const effectiveUrl = overrideUrl ?? baseUrl;

  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <button
        aria-label={overrideUrl === null ? "Add localized image" : "Change localized image"}
        className={cn(
          "relative flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border/60 bg-muted",
          overrideUrl === null && "opacity-50",
        )}
        onClick={() => setPickerOpen(true)}
        type="button"
      >
        {effectiveUrl !== "" ? (
          <img
            alt=""
            className="absolute inset-0 size-full object-cover"
            loading="lazy"
            src={effectiveUrl}
          />
        ) : (
          <ImageIcon className="size-3.5 text-muted-foreground" />
        )}
      </button>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-xs",
          overrideUrl === null ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {overrideUrl ?? (baseUrl === "" ? "No image" : baseUrl)}
      </span>
      {overrideUrl !== null && (
        <button
          aria-label="Clear localized image"
          className="flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onClear}
          type="button"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
      <AssetPickerDialog
        onOpenChange={setPickerOpen}
        onSelect={(asset) => onPick(asset.url)}
        open={pickerOpen}
        organizationId={organizationId}
      />
    </div>
  );
}

function BaseValueCell({ row }: { row: TranslationRow }) {
  if (row.kind === "image" || (row.kind === "componentProp" && row.propKind === "image")) {
    const url = row.kind === "image" ? row.base.url : row.base;
    return (
      <div className="flex items-center gap-2 px-2 py-1">
        <div className="relative flex h-9 w-14 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border/60 bg-muted">
          {url !== "" ? (
            <img
              alt=""
              className="absolute inset-0 size-full object-cover"
              loading="lazy"
              src={url}
            />
          ) : (
            <ImageIcon className="size-3.5 text-muted-foreground" />
          )}
        </div>
        <span className="min-w-0 flex-1 truncate text-muted-foreground text-xs">{url}</span>
      </div>
    );
  }
  return (
    <div className="whitespace-pre-wrap px-2 py-1.5 text-muted-foreground text-sm">{row.base}</div>
  );
}

/**
 * The Translation-mode center pane: a filter toolbar (untranslated-only,
 * screen, kind, free-text search) over the slot rows grouped by screen. Cells
 * write through the existing undoable locale actions, which no-op safely when
 * a collaborator deleted the node mid-edit.
 */
export function TranslationTable({
  groups,
  screens,
  targetLocale,
  defaultLocale,
  filter,
  onFilterChange,
  selectedKey,
  onSelectRow,
}: TranslationTableProps) {
  const dispatch = usePaywallDesignerActions();

  const commitText = (row: TranslationRow, value: string) => {
    if (row.kind === "text") {
      dispatch(updateNodeTranslation)({ id: row.nodeId, locale: targetLocale, text: value });
    } else if (row.kind === "componentProp") {
      dispatch(updateComponentPropLocalizedValue)({
        locale: targetLocale,
        nodeId: row.nodeId,
        propName: row.propName,
        value: value === "" ? null : { key: "string", value },
      });
    }
  };

  const pickImage = (row: TranslationRow, url: string) => {
    if (row.kind === "image") {
      dispatch(updateNodeLocalizedImage)({
        backgroundImage: { resizeMode: row.base.resizeMode, url },
        id: row.nodeId,
        locale: targetLocale,
      });
    } else if (row.kind === "componentProp") {
      dispatch(updateComponentPropLocalizedValue)({
        locale: targetLocale,
        nodeId: row.nodeId,
        propName: row.propName,
        value: { key: "string", value: url },
      });
    }
  };

  const clearImage = (row: TranslationRow) => {
    if (row.kind === "image") {
      dispatch(updateNodeLocalizedImage)({
        backgroundImage: null,
        id: row.nodeId,
        locale: targetLocale,
      });
    } else if (row.kind === "componentProp") {
      dispatch(updateComponentPropLocalizedValue)({
        locale: targetLocale,
        nodeId: row.nodeId,
        propName: row.propName,
        value: null,
      });
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 border-border border-b px-3 py-2">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="-translate-y-1/2 absolute top-1/2 left-2 size-3.5 text-muted-foreground" />
          <Input
            className="h-7 pl-7 text-sm"
            onChange={(event) => onFilterChange({ ...filter, search: event.target.value })}
            placeholder="Search translations…"
            value={filter.search}
          />
        </div>
        <Select
          onValueChange={(value) => onFilterChange({ ...filter, screenId: value })}
          value={filter.screenId}
        >
          <SelectTrigger className="h-7 w-36 text-xs" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All screens</SelectItem>
            {screens.map((screen) => (
              <SelectItem key={screen.id} value={screen.id}>
                {screen.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          onValueChange={(value) =>
            onFilterChange({ ...filter, kind: value as TranslationKindFilter })
          }
          value={filter.kind}
        >
          <SelectTrigger className="h-7 w-36 text-xs" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KIND_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-muted-foreground text-xs">
          <Switch
            checked={filter.untranslatedOnly}
            onCheckedChange={(checked) =>
              onFilterChange({ ...filter, untranslatedOnly: checked === true })
            }
          />
          Untranslated
        </label>
      </div>
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] border-border border-b px-3 py-1.5 text-muted-foreground text-xs">
        <span className="px-2">Element</span>
        <span className="px-2">{localeLabel(defaultLocale)} (default)</span>
        <span className="px-2">{localeLabel(targetLocale)}</span>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col px-3 pb-8">
          {groups.length === 0 && (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No translatable content matches the current filters.
            </div>
          )}
          {groups.map((group) => (
            <div className="flex flex-col" key={group.screenId}>
              <div className="px-2 pt-4 pb-1 font-medium text-muted-foreground text-xs">
                {group.screenName}
              </div>
              {group.rows.map((row) => (
                <div
                  className={cn(
                    "grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.5fr)] items-start rounded-md border border-transparent",
                    selectedKey === row.key ? "border-border bg-accent/50" : "hover:bg-accent/30",
                  )}
                  key={row.key}
                  onClick={() => onSelectRow(row.key)}
                  onFocusCapture={() => onSelectRow(row.key)}
                >
                  <div className="flex min-w-0 items-center gap-1.5 px-2 py-1.5">
                    <span className="min-w-0 truncate text-sm">{row.label}</span>
                    <Badge className="shrink-0 px-1 py-0 text-[10px]" variant="secondary">
                      {KIND_BADGE[row.kind]}
                    </Badge>
                  </div>
                  <BaseValueCell row={row} />
                  {row.kind === "image" ? (
                    <TranslationImageCell
                      baseUrl={row.base.url}
                      onClear={() => clearImage(row)}
                      onPick={(url) => pickImage(row, url)}
                      overrideUrl={row.override?.url ?? null}
                    />
                  ) : row.kind === "componentProp" && row.propKind === "image" ? (
                    <TranslationImageCell
                      baseUrl={row.base}
                      onClear={() => clearImage(row)}
                      onPick={(url) => pickImage(row, url)}
                      overrideUrl={row.override}
                    />
                  ) : (
                    <TranslationTextCell
                      base={row.base}
                      onCommit={(value) => commitText(row, value)}
                      override={row.override}
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
