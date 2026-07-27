import { createContext, useCallback, useContext, useState } from "react";

interface DatabaseContextValue {
  selectedDatabaseId: string | null;
  setSelectedDatabaseId: (id: string | null) => void;
}

const DatabaseContext = createContext<DatabaseContextValue | null>(null);

const STORAGE_KEY = "mimic-admin-selected-database";

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [selectedDatabaseId, setSelectedDatabaseIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setSelectedDatabaseId = useCallback((id: string | null) => {
    setSelectedDatabaseIdState(id);
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // ignore storage errors
    }
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
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return ctx;
}
