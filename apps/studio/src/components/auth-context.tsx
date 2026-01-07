import type { User } from "@voidhash/rpc";
import { type ReactNode, createContext, useContext } from "react";

interface AuthContextType {
  user: typeof User.Type;
}

// Default context – will trigger error if used without provider
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  user: typeof User.Type;
}

export function AuthProvider({ children, user }: AuthProviderProps) {
  return (
    <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
