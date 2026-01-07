import type { DNF } from "@voidhash/mimic-schema";
import { useCallback, useMemo, useState } from "react";
import type { CRDTVariable, LocalDNF, LocalPredicate } from "./types";
import {
	createDefaultConjunction,
	createDefaultPredicate,
	deepClone,
	deepEqual,
	dnfToLocal,
	localToDnf,
} from "./utils";

/**
 * Hook for editing DNF (Disjunctive Normal Form) conditions.
 * Manages local state, change tracking, and CRUD operations.
 */
export function useDNFEditor() {
	const [editingDNF, setEditingDNF] = useState<LocalDNF | null>(null);
	const [originalDNF, setOriginalDNF] = useState<LocalDNF | null>(null);

	const startEditing = useCallback((dnf: DNF) => {
		const local = dnfToLocal(dnf);
		setEditingDNF(deepClone(local));
		setOriginalDNF(local);
	}, []);

	const cancel = useCallback(() => {
		if (!originalDNF) {
			return;
		}
		setEditingDNF(deepClone(originalDNF));
	}, [originalDNF]);

	const reset = useCallback(() => {
		setEditingDNF(null);
		setOriginalDNF(null);
	}, []);

	const hasChanges = useMemo(() => {
		if (!editingDNF) {
			return false;
		}
		if (!originalDNF) {
			return false;
		}
		return !deepEqual(editingDNF, originalDNF);
	}, [editingDNF, originalDNF]);

	const addConjunction = useCallback((variables: readonly CRDTVariable[]) => {
		setEditingDNF((prev) => {
			if (!prev) {
				return prev;
			}
			return {
				...prev,
				value: [...prev.value, createDefaultConjunction(variables)],
			};
		});
	}, []);

	const removeConjunction = useCallback((index: number) => {
		setEditingDNF((prev) => {
			if (!prev || prev.value.length <= 1) {
				return prev;
			}
			return {
				...prev,
				value: prev.value.filter((_, i) => i !== index),
			};
		});
	}, []);

	const addPredicate = useCallback(
		(conjunctionIndex: number, variables: readonly CRDTVariable[]) => {
			setEditingDNF((prev) => {
				if (!prev) {
					return prev;
				}
				const existingConjunction = prev.value[conjunctionIndex];
				if (!existingConjunction) {
					return prev;
				}

				const newValue = [...prev.value];
				newValue[conjunctionIndex] = {
					type: "and" as const,
					value: [
						...existingConjunction.value,
						createDefaultPredicate(variables),
					],
				};
				return { type: "or" as const, value: newValue };
			});
		},
		[],
	);

	const removePredicate = useCallback(
		(conjunctionIndex: number, predicateIndex: number) => {
			setEditingDNF((prev) => {
				if (!prev) {
					return prev;
				}
				const conjunction = prev.value[conjunctionIndex];
				if (!conjunction || conjunction.value.length <= 1) {
					return prev;
				}

				const newValue = [...prev.value];
				newValue[conjunctionIndex] = {
					type: "and" as const,
					value: conjunction.value.filter((_, i) => i !== predicateIndex),
				};
				return { type: "or" as const, value: newValue };
			});
		},
		[],
	);

	const updatePredicate = useCallback(
		(
			conjunctionIndex: number,
			predicateIndex: number,
			predicate: LocalPredicate,
		) => {
			setEditingDNF((prev) => {
				if (!prev) {
					return prev;
				}
				const existingConjunction = prev.value[conjunctionIndex];
				if (!existingConjunction) {
					return prev;
				}
				const newValue = [...prev.value];
				const newPredicates = [...existingConjunction.value];
				newPredicates[predicateIndex] = predicate;
				newValue[conjunctionIndex] = {
					type: "and" as const,
					value: newPredicates,
				};
				return { type: "or" as const, value: newValue };
			});
		},
		[],
	);

	const getDNFForSave = useCallback((): DNF | null => {
		if (!editingDNF) {
			return null;
		}
		return localToDnf(editingDNF);
	}, [editingDNF]);

	return {
		addConjunction,
		addPredicate,
		cancel,
		editingDNF,
		getDNFForSave,
		hasChanges,
		removeConjunction,
		removePredicate,
		reset,
		startEditing,
		updatePredicate,
	};
}
