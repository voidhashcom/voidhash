import { createContext, useCallback, useContext, useState } from "react";
import { Effect } from "effect";

interface DatabaseContextValue {
  selectedDatabaseId: string | null;
  setSelectedDatabaseId: (id: string | null) => void;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

const STORAGE_KEY = "mimic-admin-selected-database";

/** Reads the persisted selection, yielding `null` when storage is unavailable. */
const readSelection = (): string | null =>
  Effect.runSync(
    Effect.try(() => window.localStorage.getItem(STORAGE_KEY)).pipe(
      Effect.orElseSucceed(() => null),
    ),
  );

/** Persists (or clears) the selection, ignoring storage errors. */
const writeSelection = (id: string | null): void =>
  Effect.runSync(
    Effect.try(() => {
      if (id) {
        window.localStorage.setItem(STORAGE_KEY, id);
        return;
      }
      window.localStorage.removeItem(STORAGE_KEY);
    }).pipe(Effect.ignore),
  );

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [selectedDatabaseId, setSelectedDatabaseIdState] = useState<string | null>(readSelection);

  const setSelectedDatabaseId = useCallback((id: string | null) => {
    setSelectedDatabaseIdState(id);
    writeSelection(id);
  }, []);

  return (
    <DatabaseContext.Provider value={{ selectedDatabaseId, setSelectedDatabaseId }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext);
  if (!ctx) {
    return Effect.runSync(
      Effect.die(new Error("useDatabase must be used within a DatabaseProvider")),
    );
  }
  return ctx;
}
