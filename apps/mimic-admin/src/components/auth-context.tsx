import { createContext, useCallback, useContext } from "react";
import { useNavigate } from "@tanstack/react-router";
import { type Credentials, clearCredentials, getCredentials } from "@/lib/auth";

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
    navigate({ to: "/login" });
  }, [navigate]);

  return <AuthContext.Provider value={{ credentials, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
