import { createContext, useCallback, useContext } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Effect } from "effect";
import { type Credentials, clearCredentials } from "@/lib/auth";

interface AuthContextValue {
  credentials: Credentials;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  credentials,
}: {
  children: React.ReactNode;
  credentials: Credentials;
}) {
  const navigate = useNavigate();
  const logout = useCallback(() => {
    clearCredentials();
    void navigate({ to: "/login" });
  }, [navigate]);

  return <AuthContext.Provider value={{ credentials, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Missing provider is a programmer error, not a recoverable failure:
    // `runSync` on a defect rethrows the Error verbatim to the React tree.
    return Effect.runSync(Effect.die(new Error("useAuth must be used within an AuthProvider")));
  }
  return ctx;
}
