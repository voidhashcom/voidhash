"use client";

import { canonicalizeLocaleTag } from "@voidhash/mimic-schema";
import {
  Badge,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
} from "@voidhash/ui";
import { CheckIcon, GlobeIcon, LanguagesIcon, PlusIcon, XIcon } from "lucide-react";
import * as Option from "effect/Option";
import { useMemo, useState } from "react";
import { useStore } from "zustand/react";

import { useGetLocalizableProps } from "../hooks/use-localizable-props";
import { addLocale, removeLocale, setActiveLocale, setMode } from "../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import { selectDocumentRoot } from "../state/utils/document-root";
import {
  computeLocaleCoverage,
  type LocaleCoverage,
  readLocalizationInfo,
} from "../state/utils/localization";
import { COMMON_LOCALES, localeLabel } from "../utils/locale-display";

function coverageLabel(coverage: LocaleCoverage): string {
  return `${coverage.translated}/${coverage.total}`;
}

/**
 * Action-bar locale switcher (design + preview). Always visible for
 * discoverability: it lists the default locale, every enabled locale with its
 * text/image coverage, an "Add locale…" affordance and an entry into the
 * full-screen Translation mode. Selecting a locale sets the browser-local
 * `activeLocale` (null for the default) — a view-time override that changes
 * what the canvas renders and where inline edits land.
 */
export function LocaleSwitcher() {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const [open, setOpen] = useState(false);
  const [draftTag, setDraftTag] = useState("");

  const documentRoot = useStore(store, selectDocumentRoot);
  const activeLocale = useStore(store, (state) => state.activeLocale);
  const getLocalizableProps = useGetLocalizableProps();

  const info = useMemo(() => readLocalizationInfo(documentRoot), [documentRoot]);
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

  const enabledSet = useMemo(
    () => new Set([info.defaultLocale, ...info.locales]),
    [info],
  );
  const suggestions = useMemo(
    () => COMMON_LOCALES.filter((tag) => !enabledSet.has(tag)),
    [enabledSet],
  );

  const canonicalDraft =
    draftTag.trim() === ""
      ? null
      : Option.getOrNull(canonicalizeLocaleTag(draftTag.trim()));
  const draftIsAddable =
    canonicalDraft !== null &&
    canonicalDraft !== info.defaultLocale &&
    !info.locales.includes(canonicalDraft);

  const selectLocale = (locale: string | null) => {
    dispatch(setActiveLocale)({ locale });
    setOpen(false);
  };

  const handleAdd = (tag: string) => {
    const canonical = Option.getOrNull(canonicalizeLocaleTag(tag.trim()));
    if (canonical === null || canonical === info.defaultLocale || info.locales.includes(canonical)) {
      return;
    }
    dispatch(addLocale)({ tag: canonical });
    dispatch(setActiveLocale)({ locale: canonical });
    setDraftTag("");
    setOpen(false);
  };

  const handleRemove = (tag: string) => {
    dispatch(removeLocale)({ tag });
    if (activeLocale === tag) {
      dispatch(setActiveLocale)({ locale: null });
    }
  };

  const openTranslationMode = () => {
    dispatch(setMode)({ mode: "translation" });
    setOpen(false);
  };

  const currentTag = activeLocale ?? info.defaultLocale;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label="Switch locale"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
          size="sm"
          title="Switch locale"
          variant="outline"
        >
          <GlobeIcon />
          <span className="max-w-24 truncate">{localeLabel(currentTag)}</span>
          {activeLocale === null && (
            <Badge className="px-1 py-0 text-[10px]" variant="secondary">
              Default
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-64 p-1" side="top">
        <div className="flex flex-col">
          <button
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => selectLocale(null)}
            type="button"
          >
            <span className="flex h-4 w-4 items-center justify-center">
              {activeLocale === null && <CheckIcon className="size-3.5" />}
            </span>
            <span className="flex-1 truncate">{localeLabel(info.defaultLocale)}</span>
            <Badge className="px-1 py-0 text-[10px]" variant="secondary">
              Default
            </Badge>
          </button>
          {info.locales.map((tag) => (
            <div className="flex items-center" key={tag}>
              <button
                className="flex flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                onClick={() => selectLocale(tag)}
                type="button"
              >
                <span className="flex h-4 w-4 items-center justify-center">
                  {activeLocale === tag && <CheckIcon className="size-3.5" />}
                </span>
                <span className="flex-1 truncate">{localeLabel(tag)}</span>
                <span className="shrink-0 text-muted-foreground text-xs">
                  {coverageLabel(coverage.get(tag) ?? { translated: 0, total: 0 })}
                </span>
              </button>
              <Button
                aria-label={`Remove ${localeLabel(tag)}`}
                className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={() => handleRemove(tag)}
                size="icon-sm"
                title="Remove locale"
                variant="ghost"
              >
                <XIcon />
              </Button>
            </div>
          ))}
          <Separator className="my-1" />
          <button
            className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={openTranslationMode}
            type="button"
          >
            <span className="flex h-4 w-4 items-center justify-center">
              <LanguagesIcon className="size-3.5" />
            </span>
            <span className="flex-1 truncate">Open Translation mode</span>
          </button>
          <Separator className="my-1" />
          <div className="flex items-center gap-1 px-1 py-1">
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
            <div className="flex flex-wrap gap-1 px-1 pt-1 pb-1">
              {suggestions.slice(0, 8).map((tag) => (
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
  );
}
