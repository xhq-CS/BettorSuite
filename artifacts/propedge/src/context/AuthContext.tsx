import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

export type Account = { id: number; email: string; username: string; displayName: string | null; role: "user" | "admin" };
type AuthValue = { user: Account | null; loading: boolean; login: (email: string, password: string) => Promise<void>; adminLogin: (email: string, password: string) => Promise<void>; register: (email: string, username: string, password: string) => Promise<void>; logout: () => Promise<void> };
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api<Account>("/auth/me").then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);
  const login = async (email: string, password: string) => setUser(await api<Account>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }));
  const adminLogin = async (email: string, password: string) => setUser(await api<Account>("/auth/admin-login", { method: "POST", body: JSON.stringify({ email, password }) }));
  const register = async (email: string, username: string, password: string) => setUser(await api<Account>("/auth/register", { method: "POST", body: JSON.stringify({ email, username, password }) }));
  const logout = async () => { await api("/auth/logout", { method: "POST" }); setUser(null); };
  return <AuthContext.Provider value={{ user, loading, login, adminLogin, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
