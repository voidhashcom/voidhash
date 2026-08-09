"use client";

import { Button, Card } from "@voidhash/ui";
import { MinusIcon, PlusIcon } from "lucide-react";

import {
  PanelSectionHeader,
  PanelSectionHeaderActions,
  PanelSubSectionTitle,
} from "../ui/panel-section";
import { PredicateEditor } from "./predicate-editor";
import type { CRDTVariable, LocalConjunction, LocalPredicate } from "./types";

interface ConjunctionEditorProps {
  conjunction: LocalConjunction;
  onRemove: () => void;
  onAddPredicate: () => void;
  onRemovePredicate: (predicateIndex: number) => void;
  onUpdatePredicate: (predicateIndex: number, predicate: LocalPredicate) => void;
  canRemove: boolean;
  variables: readonly CRDTVariable[];
}

/**
 * Editor for a single conjunction (AND group) containing multiple predicates.
 * Displayed as a card with "IF ALL OF THESE ARE TRUE" header.
 */
export function ConjunctionEditor({
  conjunction,
  onRemove,
  onAddPredicate,
  onRemovePredicate,
  onUpdatePredicate,
  canRemove,
  variables,
}: ConjunctionEditorProps) {
  return (
    <Card className="w-full gap-0 p-0 py-0">
      <PanelSectionHeader className="px-3 py-2">
        <PanelSubSectionTitle>IF ALL OF THESE ARE TRUE</PanelSubSectionTitle>
        <PanelSectionHeaderActions>
          <Button
            onClick={onAddPredicate}
            size="icon-sm"
            title="Add condition"
            variant="outline"
          >
            <PlusIcon />
          </Button>
          {canRemove && (
            <Button
              onClick={onRemove}
              size="icon-sm"
              title="Remove this group"
              variant="ghost"
            >
              <MinusIcon />
            </Button>
          )}
        </PanelSectionHeaderActions>
      </PanelSectionHeader>

      <div className="flex flex-col gap-2 px-3 pb-3">
        {conjunction.value.length === 0 ? (
          <div className="py-4 text-center text-muted-foreground text-xs">
            No conditions - always true
          </div>
        ) : (
          conjunction.value.map((predicate, predicateIndex) => (
            <PredicateEditor
              canRemove={conjunction.value.length > 1}
              key={`${predicate.type}-${predicate.value.left.type}-${predicateIndex}`}
              onChange={(p) => onUpdatePredicate(predicateIndex, p)}
              onRemove={() => onRemovePredicate(predicateIndex)}
              predicate={predicate}
              variables={variables}
            />
          ))
        )}
      </div>
    </Card>
  );
}
