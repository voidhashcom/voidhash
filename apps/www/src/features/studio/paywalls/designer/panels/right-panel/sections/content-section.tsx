"use client";

import { entryValue } from "@voidhash/mimic-schema";
import type { TextSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { Textarea } from "@voidhash/ui";
import { useState } from "react";
import { useStore } from "zustand/react";

import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
} from "@/features/studio/paywalls/designer/panel-kit/panel-section";
import {
  updateNodeTranslation,
  updateTextNode,
} from "@/features/studio/paywalls/designer/state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";
import { selectDefaultLocale } from "@/features/studio/paywalls/designer/state/utils/localization";

/**
 * Reads the RAW stored override text for a locale (exact tag), or `""` when no
 * override exists. Unlike `resolveText`, this never falls back to the base text
 * — the translation editor shows the empty override as an empty field (with the
 * base text as its placeholder) so an untranslated string is visibly editable.
 */
function readLocaleOverrideText(data: TextSnapshotNode["data"], locale: string): string {
  for (const entry of data.localized ?? []) {
    const value = entryValue(entry);
    if (value?.locale === locale) {
      return value.overrides?.text ?? "";
    }
  }
  return "";
}

/**
 * A commit-on-blur text field seeded from `value`. Local edits stay local until
 * blur, which fires `onCommit` only when the value actually changed. Remount it
 * (via a `key`) to re-seed when the edited target changes.
 */
function CommitTextarea({
  value,
  placeholder,
  readOnly,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <Textarea
      className="min-h-16 text-xs"
      onBlur={() => {
        if (!readOnly && draft !== value) {
          onCommit(draft);
        }
      }}
      onChange={(event) => setDraft(event.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      value={draft}
    />
  );
}

export interface ContentSectionProps {
  node: TextSnapshotNode;
}

/**
 * Right-panel "Content" section for a text node. In the default locale the base
 * string is editable (writes `updateTextNode`). In a non-default locale the base
 * string is read-only and a second field edits that locale's translation
 * (`updateNodeTranslation`; an empty value clears the override → falls back to
 * base, matching the canvas).
 */
export function ContentSection({ node }: ContentSectionProps) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const activeLocale = useStore(store, (state) => state.activeLocale);
  const defaultLocale = useStore(store, selectDefaultLocale);

  const isBaseLocale = activeLocale === null || activeLocale === defaultLocale;
  const baseText = node.data.text;
  const translation = isBaseLocale ? "" : readLocaleOverrideText(node.data, activeLocale);

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Content</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground text-xs">Base</span>
            <CommitTextarea
              key={`base:${node.id}`}
              onCommit={(next) => dispatch(updateTextNode)({ id: node.id, updates: { text: next } })}
              readOnly={!isBaseLocale}
              value={baseText}
            />
          </div>
          {!isBaseLocale && activeLocale !== null && (
            <div className="flex flex-col gap-1">
              <span className="text-muted-foreground text-xs">{activeLocale}</span>
              <CommitTextarea
                key={`locale:${node.id}:${activeLocale}`}
                onCommit={(next) =>
                  dispatch(updateNodeTranslation)({
                    id: node.id,
                    locale: activeLocale,
                    text: next,
                  })
                }
                placeholder={baseText}
                value={translation}
              />
            </div>
          )}
        </div>
      </PanelSectionContent>
    </PanelSection>
  );
}
