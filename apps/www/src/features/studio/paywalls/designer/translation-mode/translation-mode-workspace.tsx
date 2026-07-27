"use client";

import { cn } from "@voidhash/ui";
import { useMemo, useState } from "react";
import { useStore } from "zustand/react";

import { useAiPanelOffset } from "../ai-panel/use-ai-panel-offset";
import { useGetLocalizableProps } from "../hooks/use-localizable-props";
import { PANEL_DIMENSIONS } from "../panels/constants";
import { setActiveLocale } from "../state/actions";
import { usePaywallDesignerActions, usePaywallDesignerStore } from "../state/designer-store";
import { selectRenderRoot } from "../state/utils/document-root";
import { readLocalizationInfo } from "../state/utils/localization";
import {
  buildTranslationRows,
  filterTranslationGroups,
  type TranslationKindFilter,
  type TranslationRow,
} from "./build-translation-rows";
import { ContextPreview } from "./context-preview";
import { LocaleRail } from "./locale-rail";
import { TranslationTable } from "./translation-table";

/** Translation-mode-local view state (filters + search); selection lives beside it. */
export interface TranslationFilterState {
  untranslatedOnly: boolean;
  kind: TranslationKindFilter;
  screenId: string;
  search: string;
}

const INITIAL_FILTER: TranslationFilterState = {
  kind: "all",
  screenId: "all",
  search: "",
  untranslatedOnly: false,
};

/**
 * The full-screen Translation mode surface: a locale rail (enable/select
 * locales), the translation table (every localizable slot against the target
 * locale) and a read-only context preview of the selected row's screen.
 *
 * The TARGET locale reuses the store's `activeLocale` so the canvas and
 * Translation mode stay in sync; a `null`/stale value falls back to the first
 * additional locale without writing to the store. Filters, search and row
 * selection are component state — browser-local view concerns of this surface.
 */
export function TranslationModeWorkspace() {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const aiOffset = useAiPanelOffset();
  const resizeActive = useStore(store, (state) => state.viewport.panelResizeActive);

  // Draft-aware live snapshot: rows and the preview follow the document as
  // collaborators edit; a node deleted mid-edit simply drops its row.
  const documentRoot = useStore(store, selectRenderRoot);
  const activeLocale = useStore(store, (state) => state.activeLocale);
  const getLocalizableProps = useGetLocalizableProps();

  const info = useMemo(() => readLocalizationInfo(documentRoot), [documentRoot]);
  const targetLocale =
    activeLocale !== null && info.locales.includes(activeLocale)
      ? activeLocale
      : (info.locales[0] ?? null);

  const [filter, setFilter] = useState<TranslationFilterState>(INITIAL_FILTER);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const groups = useMemo(
    () =>
      targetLocale === null
        ? []
        : buildTranslationRows(documentRoot, {
            defaultLocale: info.defaultLocale,
            getLocalizableProps,
            locale: targetLocale,
          }),
    [documentRoot, targetLocale, info.defaultLocale, getLocalizableProps],
  );
  const filteredGroups = useMemo(() => filterTranslationGroups(groups, filter), [groups, filter]);

  const screens = useMemo(
    () => groups.map((group) => ({ id: group.screenId, name: group.screenName })),
    [groups],
  );

  const selectedRow = useMemo<TranslationRow | null>(() => {
    for (const group of groups) {
      for (const row of group.rows) {
        if (row.key === selectedKey) {
          return row;
        }
      }
    }
    return null;
  }, [groups, selectedKey]);

  const previewScreenId = selectedRow?.screenId ?? filteredGroups[0]?.screenId ?? null;

  return (
    <div
      className={cn(
        "absolute inset-0 flex bg-background",
        // Suspended while the AI panel is being resized so the workspace
        // tracks its live width instead of easing behind it.
        !resizeActive && "transition-[left] duration-300 ease-in-out",
      )}
      style={{ left: aiOffset, top: PANEL_DIMENSIONS.TOP_HEIGHT }}
    >
      <LocaleRail
        documentRoot={documentRoot}
        getLocalizableProps={getLocalizableProps}
        info={info}
        onSelectTarget={(tag) => dispatch(setActiveLocale)({ locale: tag })}
        targetLocale={targetLocale}
      />
      <div className="flex min-w-0 flex-1 flex-col border-border border-x">
        {targetLocale === null ? (
          <div className="flex h-full items-center justify-center p-8 text-center text-muted-foreground text-sm">
            Add a locale in the left rail to start translating.
          </div>
        ) : (
          <TranslationTable
            defaultLocale={info.defaultLocale}
            filter={filter}
            groups={filteredGroups}
            onFilterChange={setFilter}
            onSelectRow={setSelectedKey}
            screens={screens}
            selectedKey={selectedKey}
            targetLocale={targetLocale}
          />
        )}
      </div>
      <ContextPreview
        highlightNodeId={selectedRow?.nodeId ?? null}
        locale={targetLocale}
        root={documentRoot}
        screenId={previewScreenId}
      />
    </div>
  );
}
