"use client";

import { PlusIcon } from "lucide-react";
import { PanelButton } from "../ui/button";
import type { CRDTVariable, LocalDNF, LocalPredicate } from "./types";
import { ConjunctionEditor } from "./conjunction-editor";

interface DNFEditorProps {
	dnf: LocalDNF;
	onAddConjunction: (variables: readonly CRDTVariable[]) => void;
	onRemoveConjunction: (index: number) => void;
	onAddPredicate: (
		conjunctionIndex: number,
		variables: readonly CRDTVariable[],
	) => void;
	onRemovePredicate: (conjunctionIndex: number, predicateIndex: number) => void;
	onUpdatePredicate: (
		conjunctionIndex: number,
		predicateIndex: number,
		predicate: LocalPredicate,
	) => void;
	variables: readonly CRDTVariable[];
}

/**
 * Editor for DNF (Disjunctive Normal Form) conditions.
 * Displays a list of AND groups (conjunctions) separated by OR dividers.
 */
export function DNFEditor({
	dnf,
	onAddConjunction,
	onRemoveConjunction,
	onAddPredicate,
	onRemovePredicate,
	onUpdatePredicate,
	variables,
}: DNFEditorProps) {
	return (
		<div className="flex flex-col gap-3">
			{dnf.value.map((conjunction, conjunctionIndex) => (
				<div key={`conjunction-${conjunction.type}-${conjunctionIndex}`}>
					{conjunctionIndex > 0 && (
						<div className="flex items-center gap-2 py-2">
							<div className="h-px flex-1 bg-border" />
							<span className="font-medium text-muted-foreground text-xs">
								OR
							</span>
							<div className="h-px flex-1 bg-border" />
						</div>
					)}
					<ConjunctionEditor
						canRemove={dnf.value.length > 1}
						conjunction={conjunction}
						onAddPredicate={() => onAddPredicate(conjunctionIndex, variables)}
						onRemove={() => onRemoveConjunction(conjunctionIndex)}
						onRemovePredicate={(predicateIndex) =>
							onRemovePredicate(conjunctionIndex, predicateIndex)
						}
						onUpdatePredicate={(predicateIndex, predicate) =>
							onUpdatePredicate(conjunctionIndex, predicateIndex, predicate)
						}
						variables={variables}
					/>
				</div>
			))}

			{/* Add OR group button */}
			<div className="flex items-center justify-center">
				<PanelButton
					icon={<PlusIcon />}
					onClick={() => onAddConjunction(variables)}
				>
					OR
				</PanelButton>
			</div>
		</div>
	);
}
