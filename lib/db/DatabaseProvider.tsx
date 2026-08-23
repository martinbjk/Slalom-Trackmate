"use client";

import type { Database } from "sql.js";
import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { getDatabase } from "./database";

interface DbContextValue {
  db: Database | null;
  ready: boolean;
  error: string | null;
  /** Bump this after any write so consuming components know to re-query. */
  version: number;
  notifyChange: () => void;
}

const DbContext = createContext<DbContextValue>({
  db: null,
  ready: false,
  error: null,
  version: 0,
  notifyChange: () => {},
});

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getDatabase()
      .then((instance) => {
        if (!cancelled) setDb(instance);
      })
      .catch((err) => {
        console.error("Failed to initialize local database", err);
        if (!cancelled) setError(String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const notifyChange = useCallback(() => setVersion((v) => v + 1), []);

  return (
    <DbContext.Provider value={{ db, ready: db !== null, error, version, notifyChange }}>
      {children}
    </DbContext.Provider>
  );
}

export function useDatabase() {
  return useContext(DbContext);
}
