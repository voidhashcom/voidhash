"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PaywallLocationTreatmentConfig, RpcExperiment } from "@voidhash/rpc";
import { Effect } from "effect";
import { createContext, type ReactNode, useContext, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { queryKeys, saveExperimentSetupOptions } from "@/features/studio/lib/tanstack-query";

import { EXPERIMENT_STATUS } from "../../lib/experiment-status";

type Experiment = typeof RpcExperiment.Type;

export interface DraftVariant {
  /** Server id; null for a variant added in this draft. */
  id: string | null;
  /** Stable client-side identity, used to key matrix cells across renames. */
  localId: number;
  name: string;
  weightPercent: number;
}

/**
 * One matrix cell: the paywall a variant serves at a location. No release —
 * a cell always follows the paywall's latest published version.
 */
export interface DraftCell {
  paywallId: string;
}

/** Key of one matrix cell: which variant row × which location column. */
export const cellKey = (variantLocalId: number, locationId: string) =>
  `${variantLocalId}:${locationId}`;

interface DraftState {
  cells: Record<string, DraftCell>;
  description: string;
  hypothesis: string;
  /** Matrix columns, in display order. */
  locationIds: string[];
  name: string;
  primaryMetric: string;
  /** Comma-joined, mirroring how the field is edited. */
  secondaryMetrics: string;
  variants: DraftVariant[];
}

const asPaywallLocationConfig = (config: unknown): PaywallLocationTreatmentConfig | null => {
  if (
    typeof config === "object" &&
    config !== null &&
    "paywallLocationId" in config &&
    "paywallId" in config
  ) {
    return config as PaywallLocationTreatmentConfig;
  }
  return null;
};

/**
 * Even percentage split for `count` arms that always sums to exactly 100 —
 * the leftover points from integer division land on the first rows.
 */
const evenSplit = (count: number): number[] => {
  if (count === 0) {
    return [];
  }
  const base = Math.floor(100 / count);
  const remainder = 100 - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
};

const toDraft = (experiment: Experiment, nextLocalId: () => number): DraftState => {
  // Control first, so "row 0 is the control" holds from the first render.
  const ordered = [...experiment.variants].sort(
    (a, b) => Number(b.isControl) - Number(a.isControl),
  );
  const variants = ordered.map((variant) => ({
    id: variant.id,
    localId: nextLocalId(),
    name: variant.name,
    weightPercent: Math.round(variant.weightBps / 100),
  }));
  const localIdByVariantId = new Map(variants.map((v) => [v.id, v.localId]));

  const cells: Record<string, DraftCell> = {};
  const locationIds: string[] = [];
  for (const treatment of experiment.treatments) {
    if (treatment.treatmentType !== "paywall_location") {
      continue;
    }
    const config = asPaywallLocationConfig(treatment.config);
    const localId = localIdByVariantId.get(treatment.variantId);
    if (!config || localId === undefined) {
      continue;
    }
    if (!locationIds.includes(config.paywallLocationId)) {
      locationIds.push(config.paywallLocationId);
    }
    cells[cellKey(localId, config.paywallLocationId)] = { paywallId: config.paywallId };
  }

  return {
    cells,
    description: experiment.description ?? "",
    hypothesis: experiment.hypothesis ?? "",
    locationIds,
    name: experiment.name,
    primaryMetric: experiment.primaryMetricEventName ?? "",
    secondaryMetrics: (experiment.secondaryMetricEventNames ?? []).join(", "),
    variants,
  };
};

/** Parse the comma/newline separated secondary-metrics field into a clean list. */
export const parseEventNames = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  );

interface ExperimentDraftContextValue {
  addLocation: (locationId: string) => void;
  addVariant: () => void;
  /** Human-readable reason Save is blocked, or null when the draft is valid. */
  blocker: string | null;
  cells: Record<string, DraftCell>;
  changeCount: number;
  clearCell: (variantLocalId: number, locationId: string) => void;
  description: string;
  experiment: Experiment;
  hypothesis: string;
  isSaving: boolean;
  locationIds: string[];
  /** Variants and placements are frozen: archived, concluded, or running. */
  matrixLocked: boolean;
  /** Metrics are frozen once the test leaves draft. */
  metricsLocked: boolean;
  name: string;
  primaryMetric: string;
  /** Whole page is read-only: archived or concluded. */
  readOnly: boolean;
  removeLocation: (locationId: string) => void;
  removeVariant: (localId: number) => void;
  /** Swap a column to a different location, carrying its cells along. */
  replaceLocation: (oldLocationId: string, newLocationId: string) => void;
  renameVariant: (localId: number, name: string) => void;
  reset: () => void;
  save: () => void;
  secondaryMetrics: string;
  setCell: (variantLocalId: number, locationId: string, cell: DraftCell) => void;
  setDescription: (value: string) => void;
  setHypothesis: (value: string) => void;
  setName: (value: string) => void;
  setPrimaryMetric: (value: string) => void;
  setSecondaryMetrics: (value: string) => void;
  setVariantWeight: (localId: number, weightPercent: number) => void;
  splitWeightsEvenly: () => void;
  variants: DraftVariant[];
}

const ExperimentDraftContext = createContext<ExperimentDraftContextValue | null>(null);

/** Read the staged A/B-test draft; must be used under {@link ExperimentDraftProvider}. */
export function useExperimentDraft(): ExperimentDraftContextValue {
  const value = useContext(ExperimentDraftContext);
  if (!value) {
    return Effect.runSync(
      Effect.die(new Error("useExperimentDraft must be used within ExperimentDraftProvider")),
    );
  }
  return value;
}

/**
 * Holds everything the A/B-test detail page edits — title, description,
 * hypothesis, metrics, and the variants × placements matrix — as one staged
 * draft. Nothing writes to the server until the bottom action bar saves, which
 * lands the whole draft in a single `SaveExperimentSetup` request.
 */
export function ExperimentDraftProvider({
  children,
  experiment,
}: {
  children: ReactNode;
  experiment: Experiment;
}) {
  const localIdCounter = useRef(0);
  const nextLocalId = () => ++localIdCounter.current;

  const [syncedExperiment, setSyncedExperiment] = useState(experiment);
  const [draft, setDraft] = useState<DraftState>(() => toDraft(experiment, nextLocalId));

  const isArchived = experiment.archivedAt != null;
  const readOnly = isArchived || experiment.status === EXPERIMENT_STATUS.concluded;
  const matrixLocked = readOnly || experiment.status === EXPERIMENT_STATUS.running;
  const metricsLocked = readOnly || experiment.status !== EXPERIMENT_STATUS.draft;

  const queryClient = useQueryClient();
  const { isPending: isSaving, mutate: saveSetup } = useMutation({
    ...saveExperimentSetupOptions(),
    onError: () => {
      toast.error("Failed to save changes");
    },
    onSuccess: (saved) => {
      toast.success("Changes saved");
      // Reseed from the response so newly added variants pick up server ids.
      setSyncedExperiment(saved);
      setDraft(toDraft(saved, nextLocalId));
      queryClient.setQueryData(queryKeys.experiment.getExperiment(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.experiment.all });
    },
  });

  const diff = useMemo(() => {
    const saved = syncedExperiment;
    const scalars = {
      description: draft.description !== (saved.description ?? ""),
      hypothesis: draft.hypothesis !== (saved.hypothesis ?? ""),
      name: draft.name !== saved.name,
      primaryMetric: draft.primaryMetric !== (saved.primaryMetricEventName ?? ""),
      secondaryMetrics:
        parseEventNames(draft.secondaryMetrics).join(",") !==
        (saved.secondaryMetricEventNames ?? []).join(","),
    };

    const savedVariantsById = new Map(saved.variants.map((variant) => [variant.id, variant]));
    const draftIds = new Set(draft.variants.flatMap((v) => (v.id ? [v.id] : [])));
    let variantChanges = 0;
    for (const variant of saved.variants) {
      if (!draftIds.has(variant.id)) {
        variantChanges += 1;
      }
    }
    draft.variants.forEach((variant, index) => {
      const savedVariant = variant.id ? savedVariantsById.get(variant.id) : undefined;
      if (!savedVariant) {
        variantChanges += 1;
        return;
      }
      if (
        savedVariant.name !== variant.name ||
        Math.round(savedVariant.weightBps / 100) !== variant.weightPercent ||
        savedVariant.isControl !== (index === 0)
      ) {
        variantChanges += 1;
      }
    });

    // Cells compare on `${variantId}:${locationId}`; cells on brand-new
    // variants have no saved counterpart and always count as additions.
    const savedCells = new Map<string, PaywallLocationTreatmentConfig>();
    for (const treatment of saved.treatments) {
      const config = asPaywallLocationConfig(treatment.config);
      if (treatment.treatmentType === "paywall_location" && config) {
        savedCells.set(`${treatment.variantId}:${config.paywallLocationId}`, config);
      }
    }
    const localIdToVariantId = new Map(
      draft.variants.flatMap((v) => (v.id ? [[v.localId, v.id] as const] : [])),
    );
    let cellChanges = 0;
    const seenSavedKeys = new Set<string>();
    for (const [key, cell] of Object.entries(draft.cells)) {
      const [localIdRaw, locationId] = key.split(":");
      if (locationId === undefined || !draft.locationIds.includes(locationId)) {
        continue;
      }
      const variantId = localIdToVariantId.get(Number(localIdRaw));
      const savedCell = variantId ? savedCells.get(`${variantId}:${locationId}`) : undefined;
      if (variantId) {
        seenSavedKeys.add(`${variantId}:${locationId}`);
      }
      if (!savedCell || savedCell.paywallId !== cell.paywallId) {
        cellChanges += 1;
      }
    }
    for (const key of savedCells.keys()) {
      if (!seenSavedKeys.has(key)) {
        cellChanges += 1;
      }
    }

    const scalarChangeCount = Object.values(scalars).filter(Boolean).length;
    return {
      cellChanges,
      changeCount: scalarChangeCount + variantChanges + cellChanges,
      scalars,
      variantChanges,
    };
  }, [draft, syncedExperiment]);

  // Adopt background refetches only while the draft is clean, so a save from
  // another tab doesn't clobber in-progress edits here.
  if (syncedExperiment !== experiment && diff.changeCount === 0 && !isSaving) {
    setSyncedExperiment(experiment);
    setDraft(toDraft(experiment, nextLocalId));
  }

  const weightSum = draft.variants.reduce((sum, variant) => sum + variant.weightPercent, 0);
  const blocker =
    draft.name.trim().length === 0
      ? "The A/B test needs a name"
      : draft.variants.some((variant) => variant.name.trim().length === 0)
        ? "Every variant needs a name"
        : draft.variants.length > 0 && weightSum !== 100
          ? `Variant weights must add up to 100% (now ${weightSum}%)`
          : null;

  const save = () => {
    if (diff.changeCount === 0 || blocker !== null) {
      return;
    }
    const includeMatrix = diff.variantChanges + diff.cellChanges > 0;
    saveSetup({
      id: experiment.id,
      ...(diff.scalars.name ? { name: draft.name.trim() } : {}),
      ...(diff.scalars.description ? { description: draft.description || null } : {}),
      ...(diff.scalars.hypothesis ? { hypothesis: draft.hypothesis || null } : {}),
      ...(diff.scalars.primaryMetric
        ? { primaryMetricEventName: draft.primaryMetric.trim() || null }
        : {}),
      ...(diff.scalars.secondaryMetrics
        ? {
            secondaryMetricEventNames: (() => {
              const parsed = parseEventNames(draft.secondaryMetrics);
              return parsed.length > 0 ? parsed : null;
            })(),
          }
        : {}),
      ...(includeMatrix
        ? {
            variants: draft.variants.map((variant, index) => ({
              ...(variant.id ? { id: variant.id } : {}),
              isControl: index === 0,
              name: variant.name.trim(),
              treatments: draft.locationIds.flatMap((locationId) => {
                const cell = draft.cells[cellKey(variant.localId, locationId)];
                return cell ? [{ paywallId: cell.paywallId, paywallLocationId: locationId }] : [];
              }),
              weightBps: variant.weightPercent * 100,
            })),
          }
        : {}),
    });
  };

  const value: ExperimentDraftContextValue = {
    addLocation: (locationId) => {
      setDraft((prev) =>
        prev.locationIds.includes(locationId)
          ? prev
          : { ...prev, locationIds: [...prev.locationIds, locationId] },
      );
    },
    addVariant: () => {
      setDraft((prev) => {
        const letter =
          prev.variants.length < 26
            ? `Variant ${String.fromCharCode(65 + prev.variants.length)}`
            : `Variant ${prev.variants.length + 1}`;
        const variants = [
          ...prev.variants,
          { id: null, localId: nextLocalId(), name: letter, weightPercent: 0 },
        ];
        const split = evenSplit(variants.length);
        return {
          ...prev,
          variants: variants.map((variant, index) => ({
            ...variant,
            weightPercent: split[index] ?? 0,
          })),
        };
      });
    },
    blocker,
    cells: draft.cells,
    changeCount: diff.changeCount,
    clearCell: (variantLocalId, locationId) => {
      setDraft((prev) => {
        const cells = { ...prev.cells };
        delete cells[cellKey(variantLocalId, locationId)];
        return { ...prev, cells };
      });
    },
    description: draft.description,
    experiment,
    hypothesis: draft.hypothesis,
    isSaving,
    locationIds: draft.locationIds,
    matrixLocked,
    metricsLocked,
    name: draft.name,
    primaryMetric: draft.primaryMetric,
    readOnly,
    removeLocation: (locationId) => {
      setDraft((prev) => {
        const cells = Object.fromEntries(
          Object.entries(prev.cells).filter(([key]) => !key.endsWith(`:${locationId}`)),
        );
        return {
          ...prev,
          cells,
          locationIds: prev.locationIds.filter((id) => id !== locationId),
        };
      });
    },
    replaceLocation: (oldLocationId, newLocationId) => {
      setDraft((prev) => {
        if (
          oldLocationId === newLocationId ||
          !prev.locationIds.includes(oldLocationId) ||
          prev.locationIds.includes(newLocationId)
        ) {
          return prev;
        }
        const cells = Object.fromEntries(
          Object.entries(prev.cells).map(([key, cell]) => [
            key.endsWith(`:${oldLocationId}`)
              ? `${key.slice(0, key.length - oldLocationId.length)}${newLocationId}`
              : key,
            cell,
          ]),
        );
        return {
          ...prev,
          cells,
          locationIds: prev.locationIds.map((id) => (id === oldLocationId ? newLocationId : id)),
        };
      });
    },
    removeVariant: (localId) => {
      setDraft((prev) => {
        if (prev.variants.length <= 1) {
          return prev;
        }
        const variants = prev.variants.filter((variant) => variant.localId !== localId);
        const split = evenSplit(variants.length);
        const cells = Object.fromEntries(
          Object.entries(prev.cells).filter(([key]) => !key.startsWith(`${localId}:`)),
        );
        return {
          ...prev,
          cells,
          variants: variants.map((variant, index) => ({
            ...variant,
            weightPercent: split[index] ?? 0,
          })),
        };
      });
    },
    renameVariant: (localId, name) => {
      setDraft((prev) => ({
        ...prev,
        variants: prev.variants.map((variant) =>
          variant.localId === localId ? { ...variant, name } : variant,
        ),
      }));
    },
    reset: () => {
      setDraft(toDraft(syncedExperiment, nextLocalId));
    },
    save,
    secondaryMetrics: draft.secondaryMetrics,
    setCell: (variantLocalId, locationId, cell) => {
      setDraft((prev) => ({
        ...prev,
        cells: { ...prev.cells, [cellKey(variantLocalId, locationId)]: cell },
      }));
    },
    setDescription: (description) => setDraft((prev) => ({ ...prev, description })),
    setHypothesis: (hypothesis) => setDraft((prev) => ({ ...prev, hypothesis })),
    setName: (name) => setDraft((prev) => ({ ...prev, name })),
    setPrimaryMetric: (primaryMetric) => setDraft((prev) => ({ ...prev, primaryMetric })),
    setSecondaryMetrics: (secondaryMetrics) => setDraft((prev) => ({ ...prev, secondaryMetrics })),
    setVariantWeight: (localId, weightPercent) => {
      const clamped = Math.min(100, Math.max(0, Math.round(weightPercent)));
      setDraft((prev) => ({
        ...prev,
        variants: prev.variants.map((variant) =>
          variant.localId === localId ? { ...variant, weightPercent: clamped } : variant,
        ),
      }));
    },
    splitWeightsEvenly: () => {
      setDraft((prev) => {
        const split = evenSplit(prev.variants.length);
        return {
          ...prev,
          variants: prev.variants.map((variant, index) => ({
            ...variant,
            weightPercent: split[index] ?? 0,
          })),
        };
      });
    },
    variants: draft.variants,
  };

  return (
    <ExperimentDraftContext.Provider value={value}>{children}</ExperimentDraftContext.Provider>
  );
}
