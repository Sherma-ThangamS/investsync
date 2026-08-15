"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import {
  apiGetMe,
  apiLogin,
  apiRegister,
  clearToken,
  getToken,
  type AuthUser,
} from "../lib/api";

/* ── Context shape ── */

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (id: string, password: string) => Promise<void>;
  register: (params: {
    id: string;
    name: string;
    role: "master" | "follower";
    initialCapital: number;
    password: string;
  }) => Promise<void>;
  logout: () => void;
  /** Check if current user has admin role */
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/* ── Provider ── */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  /* On mount, check if an existing token is still valid */
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    apiGetMe()
      .then((u) => setUser(u))
      .catch(() => {
        clearToken();
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (id: string, password: string) => {
    const data = await apiLogin({ id, password });
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (params: {
      id: string;
      name: string;
      role: "master" | "follower";
      initialCapital: number;
      password: string;
    }) => {
      const data = await apiRegister(params);
      setUser(data.user);
    },
    [],
  );

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAdmin: user?.role === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}

/* ── Hook ── */

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return ctx;
}
