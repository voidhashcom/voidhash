"use client";

import { resolveComponentPropValue } from "@voidhash/mimic-schema";
import type { ComponentSnapshotNode } from "@voidhash/paywall-renderer-web-core";
import { useMemo } from "react";
import { useStore } from "zustand/react";

import {
  PanelSection,
  PanelSectionContent,
  PanelSectionHeader,
  PanelSectionTitle,
} from "@/features/studio/paywalls/designer/panel-kit/panel-section";
import { PropFieldRow } from "@/features/studio/paywalls/designer/panel-kit/prop-field-row";
import { useComponentManifest } from "@/features/studio/paywalls/designer/hooks/use-component-manifest";
import {
  removeComponentProp,
  updateComponentPropBinding,
  updateComponentPropLocalizedValue,
} from "@/features/studio/paywalls/designer/state/actions";
import {
  usePaywallDesignerActions,
  usePaywallDesignerStore,
} from "@/features/studio/paywalls/designer/state/designer-store";
import {
  collectAncestorVariables,
  toLabeledVariables,
} from "@/features/studio/paywalls/designer/state/utils/ancestor-variables";
import {
  componentPropBindingFromRaw,
  findComponentPropEntry,
} from "@/features/studio/paywalls/designer/state/utils/component-prop-values";
import { selectDocumentRoot } from "@/features/studio/paywalls/designer/state/utils/document-root";
import {
  readLocalizableComponentProp,
  selectDefaultLocale,
} from "@/features/studio/paywalls/designer/state/utils/localization";

const NO_VARIABLES = [] as const;

export interface ComponentPropsSectionProps {
  node: ComponentSnapshotNode;
}

export function ComponentPropsSection({ node }: ComponentPropsSectionProps) {
  const store = usePaywallDesignerStore();
  const dispatch = usePaywallDesignerActions();
  const documentRoot = useStore(store, selectDocumentRoot);
  const activeLocale = useStore(store, (state) => state.activeLocale);
  const defaultLocale = useStore(store, selectDefaultLocale);

  const manifest = useComponentManifest(node);

  const variables = useMemo(
    () => toLabeledVariables(collectAncestorVariables(documentRoot, node.id), node.id),
    [documentRoot, node.id],
  );

  const propEntries = useMemo(
    () => (manifest === undefined ? [] : Object.entries(manifest.props)),
    [manifest],
  );

  const localeTag = activeLocale !== null && activeLocale !== defaultLocale ? activeLocale : null;

  return (
    <PanelSection>
      <PanelSectionHeader>
        <PanelSectionTitle>Props</PanelSectionTitle>
      </PanelSectionHeader>
      <PanelSectionContent>
        {manifest === undefined ? (
          <p className="text-muted-foreground text-xs">
            This version is not in the project catalog, so its props can&apos;t be edited.
          </p>
        ) : propEntries.length === 0 ? (
          <p className="text-muted-foreground text-xs">This component declares no props.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {propEntries.map(([propName, def]) => {
              const storedEntry = findComponentPropEntry(node.data.props, propName);
              const storedBinding =
                storedEntry === undefined
                  ? undefined
                  : componentPropBindingFromRaw(storedEntry.raw);

              // A literal-bound string/image prop marked `.localizable()` edits
              // the active locale's override instead of the base binding.
              const isLocalizableKind =
                (def.kind === "string" || def.kind === "image") && def.localizable === true;
              const prop = isLocalizableKind
                ? readLocalizableComponentProp(node, propName)
                : undefined;
              if (
                localeTag !== null &&
                isLocalizableKind &&
                prop !== undefined &&
                prop.value.type === "literal"
              ) {
                const resolved = resolveComponentPropValue(prop, localeTag, defaultLocale);
                const hasOverride = resolved !== prop.value;
                const resolvedPlain = componentPropBindingFromRaw(resolved);
                return (
                  <PropFieldRow
                    def={def}
                    key={propName}
                    localeEditing={{ badge: localeTag, hasOverride }}
                    onResetProp={(name) =>
                      dispatch(updateComponentPropLocalizedValue)({
                        locale: localeTag,
                        nodeId: node.id,
                        propName: name,
                        value: null,
                      })
                    }
                    onSetProp={(name, binding) => {
                      if (binding.type !== "literal") {
                        return;
                      }
                      dispatch(updateComponentPropLocalizedValue)({
                        locale: localeTag,
                        nodeId: node.id,
                        propName: name,
                        value: binding.value,
                      });
                    }}
                    propName={propName}
                    targets={[{ id: node.id, storedBinding: resolvedPlain }]}
                    variables={NO_VARIABLES}
                  />
                );
              }

              return (
                <PropFieldRow
                  def={def}
                  key={propName}
                  onResetProp={(name) => dispatch(removeComponentProp)({ nodeId: node.id, propName: name })}
                  onSetProp={(name, binding) =>
                    dispatch(updateComponentPropBinding)({ binding, nodeId: node.id, propName: name })
                  }
                  propName={propName}
                  targets={[{ id: node.id, storedBinding }]}
                  variables={variables}
                />
              );
            })}
          </div>
        )}
      </PanelSectionContent>
    </PanelSection>
  );
}
