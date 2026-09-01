"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Effect, Result } from "effect";
import { createContext, type ReactNode, useContext, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  getFeatureFlagOptions,
  queryKeys,
  saveFeatureFlagDraftOptions,
} from "@/features/studio/lib/tanstack-query";

import type { FlagType } from "../../lib/flag-type";

interface SavedVariant {
  id: string;
  label: string | null;
  value: unknown;
}

interface SavedTarget {
  id: string;
  identityType: number;
  identityValue: string;
  listType: number;
}

interface SavedOverride {
  forcedEnabled: boolean | null;
  id: string;
  identityType: number;
  identityValue: string;
  note: string | null;
}

/** The slice of a feature flag the detail screen edits. */
export interface FeatureFlagDetail {
  description: string | null;
  isEnabled: boolean;
  id: string;
  overrides: readonly SavedOverride[];
  rolloutBps: number;
  targets: readonly SavedTarget[];
  type: FlagType;
  variants: readonly SavedVariant[];
}

export interface DraftVariant {
  /** Absent until the variant has been saved for the first time. */
  id?: string;
  label: string;
  localId: number;
  /** Raw text; parsed against the flag type on save. */
  value: string;
}

export interface DraftTarget {
  id?: string;
  identityType: number;
  identityValue: string;
  listType: number;
  localId: number;
}

export interface DraftOverride {
  forcedEnabled: boolean | null;
  id?: string;
  identityType: number;
  identityValue: string;
  localId: number;
  note: string;
}

interface FlagDraft {
  description: string;
  enabled: boolean;
  overrides: DraftOverride[];
  rolloutBps: number;
  targets: DraftTarget[];
  variants: DraftVariant[];
}

interface FlagDraftValue extends FlagDraft {
  addOverride: (override: Omit<DraftOverride, "localId">) => void;
  addTarget: (target: Omit<DraftTarget, "localId">) => void;
  addVariant: () => void;
  /** How many individual edits are waiting to be saved. */
  changeCount: number;
  flagType: FlagType;
  /** Local ids of variants whose value does not parse as the flag's type. */
  invalidVariantIds: ReadonlySet<number>;
  isSaving: boolean;
  patchVariant: (localId: number, patch: Partial<Omit<DraftVariant, "localId">>) => void;
  /** Internal or archived flags stage nothing — every control renders read-only. */
  readOnly: boolean;
  removeOverride: (localId: number) => void;
  removeTarget: (localId: number) => void;
  removeVariant: (localId: number) => void;
  reset: () => void;
  save: () => void;
  setDescription: (description: string) => void;
  setEnabled: (enabled: boolean) => void;
  setRolloutBps: (rolloutBps: number) => void;
}

let nextLocalId = 0;

/** Formats a saved variant value for the text input that edits it. */
const formatVariantValue = (type: FlagType, value: unknown): string => {
  if (type === "json") return JSON.stringify(value, null, 2) ?? "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
};

/** Reads an edited variant value back into the flag's type. Throws when invalid. */
export const parseVariantValue = (type: FlagType, value: string): unknown => {
  if (type === "string") {
    return value;
  }
  if (type === "number") {
    const parsed = Number(value);
    if (value.trim() === "" || !Number.isFinite(parsed)) {
      // `runSync` squashes the cause, so callers still catch this exact Error.
      return Effect.runSync(Effect.die(new Error("Enter a valid number")));
    }
    return parsed;
  }
  return JSON.parse(value);
};

const targetKey = (target: Pick<DraftTarget, "identityType" | "identityValue" | "listType">) =>
  `${target.listType}:${target.identityType}:${target.identityValue}`;

const overrideKey = (
  override: Pick<DraftOverride, "forcedEnabled" | "identityType" | "identityValue" | "note">,
) =>
  `${override.identityType}:${override.identityValue}:${override.forcedEnabled}:${override.note}`;

const toDraft = (flag: FeatureFlagDetail): FlagDraft => ({
  description: flag.description ?? "",
  enabled: flag.isEnabled,
  overrides: flag.overrides.map((override) => ({
    forcedEnabled: override.forcedEnabled,
    id: override.id,
    identityType: override.identityType,
    identityValue: override.identityValue,
    localId: nextLocalId++,
    note: override.note ?? "",
  })),
  rolloutBps: flag.rolloutBps,
  targets: flag.targets.map((target) => ({
    id: target.id,
    identityType: target.identityType,
    identityValue: target.identityValue,
    listType: target.listType,
    localId: nextLocalId++,
  })),
  variants: flag.variants.map((variant) => ({
    id: variant.id,
    label: variant.label ?? "",
    localId: nextLocalId++,
    value: formatVariantValue(flag.type, variant.value),
  })),
});

const FlagDraftContext = createContext<FlagDraftValue | null>(null);

/**
 * Every field on the flag detail screen writes here instead of firing its own
 * mutation, so the whole screen is saved once from the bottom action bar.
 */
export function useFlagDraft(): FlagDraftValue {
  const value = useContext(FlagDraftContext);
  if (!value) {
    return Effect.runSync(
      Effect.die(new Error("useFlagDraft must be used inside a FlagDraftProvider")),
    );
  }
  return value;
}

export function FlagDraftProvider({
  children,
  flag,
  readOnly = false,
}: {
  children: ReactNode;
  flag: FeatureFlagDetail;
  readOnly?: boolean;
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<FlagDraft>(() => toDraft(flag));
  const [syncedFlag, setSyncedFlag] = useState(flag);

  const savedVariantRows = useMemo(
    () =>
      flag.variants.map((variant) => ({
        label: variant.label ?? "",
        value: formatVariantValue(flag.type, variant.value),
      })),
    [flag],
  );

  // Boolean flags have no variants panel, so rows stored against one are not
  // editable here — flagging them would block saving with nothing to fix.
  const invalidVariantIds = useMemo(() => {
    const invalid = new Set<number>();
    if (flag.type === "boolean") {
      return invalid;
    }
    for (const variant of draft.variants) {
      const parsed = Effect.runSync(
        Effect.try(() => parseVariantValue(flag.type, variant.value)).pipe(Effect.result),
      );
      if (Result.isFailure(parsed)) {
        invalid.add(variant.localId);
      }
    }
    return invalid;
  }, [draft.variants, flag.type]);

  const diff = useMemo(() => {
    const savedOverrideRows = flag.overrides.map((override) => ({
      ...override,
      note: override.note ?? "",
    }));
    const draftTargetKeys = new Set(draft.targets.map(targetKey));
    const savedTargetKeys = new Set(flag.targets.map(targetKey));
    const draftOverrideKeys = new Set(draft.overrides.map(overrideKey));
    const savedOverrideKeys = new Set(savedOverrideRows.map(overrideKey));

    const sharedVariants = Math.min(draft.variants.length, savedVariantRows.length);
    let variantChanges = Math.abs(draft.variants.length - savedVariantRows.length);
    for (let index = 0; index < sharedVariants; index++) {
      const drafted = draft.variants[index]!;
      const saved = savedVariantRows[index]!;
      if (drafted.label !== saved.label || drafted.value !== saved.value) {
        variantChanges++;
      }
    }

    const description = draft.description.trim();
    const flagPatch = {
      ...(description === (flag.description ?? "")
        ? {}
        : { description: description.length > 0 ? description : null }),
      ...(draft.enabled === flag.isEnabled ? {} : { enabled: draft.enabled }),
      ...(draft.rolloutBps === flag.rolloutBps ? {} : { rolloutBps: draft.rolloutBps }),
    };

    const archivedTargetIds = flag.targets
      .filter((target) => !draftTargetKeys.has(targetKey(target)))
      .map((target) => target.id);
    const addedTargets = draft.targets.filter((target) => !savedTargetKeys.has(targetKey(target)));
    const archivedOverrideIds = savedOverrideRows
      .filter((override) => !draftOverrideKeys.has(overrideKey(override)))
      .map((override) => override.id);
    const addedOverrides = draft.overrides.filter(
      (override) => !savedOverrideKeys.has(overrideKey(override)),
    );

    const flagChanges = Object.keys(flagPatch).length;

    return {
      addedOverrides,
      addedTargets,
      archivedOverrideIds,
      archivedTargetIds,
      changeCount:
        flagChanges +
        variantChanges +
        archivedTargetIds.length +
        addedTargets.length +
        archivedOverrideIds.length +
        addedOverrides.length,
      flagPatch: flagChanges > 0 ? flagPatch : undefined,
      variantsChanged: variantChanges > 0,
    };
  }, [draft, flag, savedVariantRows]);

  // Track server data that arrives on its own — a background refetch, or another
  // tab saving this flag. Only adopt it while the draft is clean, so an edit in
  // progress is never silently replaced. Saving re-seeds explicitly below.
  if (syncedFlag !== flag && diff.changeCount === 0) {
    setSyncedFlag(flag);
    setDraft(toDraft(flag));
  }

  const { isPending: isSaving, mutate: saveDraft } = useMutation({
    ...saveFeatureFlagDraftOptions(),
    onError: (error) =>
      toast.error(
        error._tag === "EffectQueryFailure"
          ? error.match({
              "Rpc/ActionForbiddenError": (failure) => failure.message,
              "Rpc/FeatureFlagNotFoundError": (failure) => failure.message,
              OrElse: () => "Failed to save changes",
            })
          : "Failed to save changes",
      ),
    // The screen is committed through several RPCs, so the saved flag only comes
    // back on a refetch. Re-seed from it rather than from what was sent: that
    // attaches server ids to the rows just created and leaves the bar showing
    // whatever genuinely still differs.
    onSuccess: async () => {
      toast.success("Changes saved");
      await queryClient.invalidateQueries({
        queryKey: queryKeys.featureFlag.getFlag(flag.id),
        refetchType: "none",
      });
      const updated = await queryClient.fetchQuery(getFeatureFlagOptions({ id: flag.id }));
      setSyncedFlag(updated);
      setDraft(toDraft(updated));
      void queryClient.invalidateQueries({ queryKey: queryKeys.featureFlag.all });
    },
  });

  const value: FlagDraftValue = {
    ...draft,
    addOverride: (override) =>
      setDraft((current) => ({
        ...current,
        overrides: [...current.overrides, { ...override, localId: nextLocalId++ }],
      })),
    addTarget: (target) =>
      setDraft((current) => ({
        ...current,
        targets: [...current.targets, { ...target, localId: nextLocalId++ }],
      })),
    addVariant: () =>
      setDraft((current) => ({
        ...current,
        variants: [
          ...current.variants,
          { label: "", localId: nextLocalId++, value: flag.type === "json" ? "{}" : "" },
        ],
      })),
    changeCount: diff.changeCount,
    flagType: flag.type,
    invalidVariantIds,
    isSaving,
    patchVariant: (localId, patch) =>
      setDraft((current) => ({
        ...current,
        variants: current.variants.map((variant) =>
          variant.localId === localId ? { ...variant, ...patch } : variant,
        ),
      })),
    readOnly,
    removeOverride: (localId) =>
      setDraft((current) => ({
        ...current,
        overrides: current.overrides.filter((override) => override.localId !== localId),
      })),
    removeTarget: (localId) =>
      setDraft((current) => ({
        ...current,
        targets: current.targets.filter((target) => target.localId !== localId),
      })),
    removeVariant: (localId) =>
      setDraft((current) => ({
        ...current,
        variants: current.variants.filter((variant) => variant.localId !== localId),
      })),
    reset: () => setDraft(toDraft(flag)),
    save: () => {
      if (invalidVariantIds.size > 0 || diff.changeCount === 0) {
        return;
      }

      saveDraft({
        addedOverrides: diff.addedOverrides.map((override) => ({
          forcedEnabled: override.forcedEnabled,
          identityType: override.identityType,
          identityValue: override.identityValue,
          ...(override.note.trim() ? { note: override.note.trim() } : {}),
        })),
        addedTargets: diff.addedTargets.map((target) => ({
          identityType: target.identityType,
          identityValue: target.identityValue,
          listType: target.listType,
        })),
        archivedOverrideIds: diff.archivedOverrideIds,
        archivedTargetIds: diff.archivedTargetIds,
        id: flag.id,
        ...(diff.flagPatch ? { flag: diff.flagPatch } : {}),
        ...(diff.variantsChanged
          ? {
              variants: draft.variants.map((variant) => ({
                ...(variant.id ? { id: variant.id } : {}),
                ...(flag.type !== "json" && variant.label.trim()
                  ? { label: variant.label.trim() }
                  : {}),
                value: parseVariantValue(flag.type, variant.value),
              })),
            }
          : {}),
      });
    },
    setDescription: (description) => setDraft((current) => ({ ...current, description })),
    setEnabled: (enabled) => setDraft((current) => ({ ...current, enabled })),
    setRolloutBps: (rolloutBps) => setDraft((current) => ({ ...current, rolloutBps })),
  };

  return <FlagDraftContext.Provider value={value}>{children}</FlagDraftContext.Provider>;
}
