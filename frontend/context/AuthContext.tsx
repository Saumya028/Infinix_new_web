"use client";

/**
 * Ported from the old site's context/AuthContext.jsx — same core idea
 * (user + token in localStorage, read on mount), rewritten for Next.js:
 *   - localStorage can't be touched during SSR (no `window` on the
 *     server), so we start both pieces of state as null/undefined and
 *     hydrate them from localStorage in a useEffect that runs once the
 *     component mounts in the browser. `isLoading` tells consumers
 *     (Header, checkout page) "we haven't checked localStorage yet" so
 *     they don't flash a logged-out UI for a split second before it loads.
 *   - We verify the stored token against GET /auth/me on load rather than
 *     trusting the cached `user` object blindly — if the token expired or
 *     was revoked server-side, this catches it immediately instead of the
 *     user finding out only when their next action gets a 401.
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import { ApiError, clientFetch } from "@/lib/clientApi";
import type { TokenResponse, User } from "@/lib/types";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (fullName: string, email: string, password: string, phone?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyTokens = useCallback((tokens: TokenResponse) => {
    localStorage.setItem("access_token", tokens.access_token);
    localStorage.setItem("refresh_token", tokens.refresh_token);
  }, []);

  const clearTokens = useCallback(() => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setIsLoading(false);
      return;
    }
    clientFetch<User>("/auth/me")
      .then(setUser)
      .catch(() => clearTokens()) // expired/invalid token — quietly log out
      .finally(() => setIsLoading(false));
  }, [clearTokens]);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await clientFetch<TokenResponse>("/auth/login", {
      method: "POST", body: { email, password }, auth: false,
    });
    applyTokens(tokens);
    const me = await clientFetch<User>("/auth/me");
    setUser(me);
  }, [applyTokens]);

  const register = useCallback(async (
    fullName: string, email: string, password: string, phone?: string,
  ) => {
    await clientFetch<User>("/auth/register", {
      method: "POST",
      body: { full_name: fullName, email, password, phone: phone || undefined },
      auth: false,
    });
    // Registration doesn't log the user in automatically on the backend
    // (it just creates the account) — chain straight into login so the
    // person doesn't have to submit their password twice in a row.
    await login(email, password);
  }, [login]);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, [clearTokens]);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout }),
    [user, isLoading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ApiError };
