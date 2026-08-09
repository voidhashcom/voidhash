"use client";

import { canonicalizeLocaleTag } from "@voidhash/mimic-schema";
import type { RootSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import {
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  useConfirmDialog,
} from "@voidhash/ui";
import { MoreHorizontalIcon, PlusIcon } from "lucide-react";
import { useMemo, useState } from "react";

import type { GetLocalizablePropInfos } from "../hooks/use-localizable-props";
import {
  addLocale,
  clearLocale,
  copyLocaleFrom,
  removeLocale,
  setActiveLocale,
  setDefaultLocale,
} from "../state/actions";
import { usePaywallDesignerActions } from "../state/designer-store";
import {
  computeLocaleCoverage,
  type LocaleCoverage,
  type LocalizationInfo,
} from "../state/utils/localization";
import { COMMON_LOCALES, localeLabel } from "../utils/locale-display";

interface LocaleRailProps {
  documentRoot: RootSnapshotNode;
  info: LocalizationInfo;
  targetLocale: string | null;
  onSelectTarget: (tag: string) => void;
  getLocalizableProps: GetLocalizablePropInfos;
}

function CoverageBar({ coverage }: { coverage: LocaleCoverage }) {
  const percent = coverage.total === 0 ? 0 : (coverage.translated / coverage.total) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
        {coverage.translated}/{coverage.total}
      </span>
    </div>
  );
}

/**
 * Translation mode's left rail: the default locale, every enabled locale with
 * its coverage bar, target-locale selection and the locale lifecycle actions —
 * add (canonicalized free input + curated suggestions), remove (confirmed;
 * CASCADE-deletes the locale's translations), set default (confirmed;
 * metadata-only relabel), copy-from and clear.
 */
export function LocaleRail({
  documentRoot,
  info,
  targetLocale,
  onSelectTarget,
  getLocalizableProps,
}: LocaleRailProps) {
  const dispatch = usePaywallDesignerActions();
  const { ConfirmationDialog, openDialog } = useConfirmDialog();
  const [addOpen, setAddOpen] = useState(false);
  const [draftTag, setDraftTag] = useState("");

  const coverage = useMemo(() => {
    const byLocale = new Map<string, LocaleCoverage>();
    for (const tag of info.locales) {
      byLocale.set(
        tag,
        computeLocaleCoverage(documentRoot, tag, info.defaultLocale, getLocalizableProps),
      );
    }
    return byLocale;
  }, [documentRoot, info, getLocalizableProps]);

  const enabledSet = useMemo(() => new Set([info.defaultLocale, ...info.locales]), [info]);
  const suggestions = useMemo(
    () => COMMON_LOCALES.filter((tag) => !enabledSet.has(tag)),
    [enabledSet],
  );

  const canonicalDraft = draftTag.trim() === "" ? null : canonicalizeLocaleTag(draftTag.trim());
  const draftIsAddable =
    canonicalDraft !== null &&
    canonicalDraft !== info.defaultLocale &&
    !info.locales.includes(canonicalDraft);

  const handleAdd = (tag: string) => {
    const canonical = canonicalizeLocaleTag(tag.trim());
    if (canonical === null || canonical === info.defaultLocale || info.locales.includes(canonical)) {
      return;
    }
    dispatch(addLocale)({ tag: canonical });
    dispatch(setActiveLocale)({ locale: canonical });
    setDraftTag("");
    setAddOpen(false);
  };

  const handleRemove = async (tag: string) => {
    const confirmed = await openDialog({
      confirmText: "Remove locale",
      description: `This disables ${localeLabel(tag)} and deletes every ${localeLabel(tag)} translation on this paywall — texts, images and component props. You can undo this.`,
      title: `Remove ${localeLabel(tag)}?`,
      variant: "destructive",
    });
    if (!confirmed) {
      return;
    }
    dispatch(removeLocale)({ tag });
    if (targetLocale === tag) {
      dispatch(setActiveLocale)({ locale: null });
    }
  };

  const handleSetDefault = async (tag: string) => {
    const confirmed = await openDialog({
      confirmText: "Set as default",
      description: `All base content is relabeled as ${localeLabel(tag)} — no text or images change. ${localeLabel(info.defaultLocale)} becomes an additional locale with no translations of its own.`,
      title: `Make ${localeLabel(tag)} the default?`,
    });
    if (!confirmed) {
      return;
    }
    dispatch(setDefaultLocale)({ tag });
    if (targetLocale === tag) {
      dispatch(setActiveLocale)({ locale: null });
    }
  };

  const handleClear = async (tag: string) => {
    const confirmed = await openDialog({
      confirmText: "Clear translations",
      description: `This deletes every ${localeLabel(tag)} translation but keeps the locale enabled. You can undo this.`,
      title: `Clear ${localeLabel(tag)} translations?`,
      variant: "destructive",
    });
    if (confirmed) {
      dispatch(clearLocale)({ tag });
    }
  };

  return (
    <div className="flex w-60 shrink-0 flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="font-medium text-muted-foreground text-xs">Locales</span>
        <Popover onOpenChange={setAddOpen} open={addOpen}>
          <PopoverTrigger asChild>
            <Button aria-label="Add locale" size="icon-sm" title="Add locale" variant="ghost">
              <PlusIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-2" side="right">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1">
                <Input
                  className="h-7 text-sm"
                  onChange={(event) => setDraftTag(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && draftIsAddable) {
                      event.preventDefault();
                      handleAdd(draftTag);
                    }
                  }}
                  placeholder="Add locale… (e.g. de, pt-BR)"
                  value={draftTag}
                />
                <Button
                  aria-label="Add locale"
                  disabled={!draftIsAddable}
                  onClick={() => handleAdd(draftTag)}
                  size="icon-sm"
                  title="Add locale"
                  variant="outline"
                >
                  <PlusIcon />
                </Button>
              </div>
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {suggestions.slice(0, 10).map((tag) => (
                    <button
                      className="rounded-full border border-border px-2 py-0.5 text-muted-foreground text-xs hover:bg-accent hover:text-foreground"
                      key={tag}
                      onClick={() => handleAdd(tag)}
                      type="button"
                    >
                      {localeLabel(tag)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-0.5 px-2 pb-2">
          <div className="flex items-center gap-2 rounded-sm px-2 py-1.5">
            <span className="flex-1 truncate text-sm">{localeLabel(info.defaultLocale)}</span>
            <Badge className="px-1 py-0 text-[10px]" variant="secondary">
              Default
            </Badge>
          </div>
          {info.locales.map((tag) => (
            <div
              className={cn(
                "group flex items-center gap-1 rounded-sm",
                targetLocale === tag ? "bg-accent" : "hover:bg-accent/50",
              )}
              key={tag}
            >
              <button
                className="flex min-w-0 flex-1 flex-col gap-1 px-2 py-1.5 text-left"
                onClick={() => onSelectTarget(tag)}
                type="button"
              >
                <span className="truncate text-sm">{localeLabel(tag)}</span>
                <CoverageBar coverage={coverage.get(tag) ?? { translated: 0, total: 0 }} />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={`${localeLabel(tag)} actions`}
                    className="mr-1 size-6 shrink-0 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                    size="icon-sm"
                    variant="ghost"
                  >
                    <MoreHorizontalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="right">
                  <DropdownMenuItem onClick={() => void handleSetDefault(tag)}>
                    Set as default…
                  </DropdownMenuItem>
                  {info.locales.length > 1 && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Copy translations from</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        {info.locales
                          .filter((source) => source !== tag)
                          .map((source) => (
                            <DropdownMenuItem
                              key={source}
                              onClick={() => dispatch(copyLocaleFrom)({ source, target: tag })}
                            >
                              {localeLabel(source)}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void handleClear(tag)}>
                    Clear translations…
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void handleRemove(tag)} variant="destructive">
                    Remove locale…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </ScrollArea>
      <ConfirmationDialog />
    </div>
  );
}
