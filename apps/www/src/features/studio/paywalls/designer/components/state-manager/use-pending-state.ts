import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import type { DnfInput } from "../../state/utils/replay";
import { createDefaultCondition } from "./utils";

interface UsePendingStateOptions {
  existingStateNames: Set<string>;
  onAddState: (name: string, condition: DnfInput) => void;
}

/**
 * Hook for managing the "add new state" flow.
 * Handles input focus, name validation, and keyboard events.
 */
export function usePendingState({ existingStateNames, onAddState }: UsePendingStateOptions) {
  const [pendingState, setPendingState] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const startAdding = useCallback(() => {
    setPendingState("");
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, []);

  const cancel = useCallback(() => {
    setPendingState(null);
  }, []);

  const save = useCallback(() => {
    if (pendingState === null) {
      return;
    }

    const trimmedName = pendingState.trim();

    if (!trimmedName) {
      setPendingState(null);
      return;
    }

    if (trimmedName.length > 32) {
      toast.error("State name must be less than 32 characters");
      setPendingState(null);
      return;
    }

    if (existingStateNames.has(trimmedName)) {
      toast.error("A state with this name already exists");
      setPendingState(null);
      return;
    }

    onAddState(trimmedName, createDefaultCondition());
    setPendingState(null);
  }, [pendingState, existingStateNames, onAddState]);

  const updateName = useCallback((name: string) => {
    setPendingState(name);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        cancel();
      } else if (e.key === "Enter") {
        save();
      }
    },
    [cancel, save],
  );

  return {
    cancel,
    handleKeyDown,
    inputRef,
    isPending: pendingState !== null,
    pendingState,
    save,
    startAdding,
    updateName,
  };
}
