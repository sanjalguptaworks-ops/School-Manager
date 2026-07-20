import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: "creator" | "admin" | "teacher" | "student" | "parent";
  schoolId?: number | null;
  studentId?: number | null;
  teacherId?: number | null;
  [key: string]: any;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  // True when we couldn't get a definitive answer from the server (network
  // error, or a 5xx/timeout — e.g. the backend waking up from an idle
  // spin-down) after retrying. Distinct from "confirmed logged out" (a real
  // 401), which just sets user to null instead.
  authError: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  authError: false,
  login: async () => ({ ok: false }),
  logout: async () => {},
  refresh: async () => null,
});

const REFRESH_RETRIES = 2;
const REFRESH_RETRY_DELAY_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(false);

  const refresh = useCallback(async () => {
    setAuthError(false);
    for (let attempt = 0; attempt <= REFRESH_RETRIES; attempt++) {
      try {
        const res = await fetch(`${BASE_URL}/api/users/me`, { credentials: "include" });
        if (res.ok) {
          const me = await res.json();
          setUser(me);
          setIsLoading(false);
          return me;
        }
        if (res.status === 401) {
          // Genuinely not logged in — no point retrying.
          setUser(null);
          setIsLoading(false);
          return null;
        }
        // Any other status (e.g. 502/504 while the server wakes up) is
        // worth a retry rather than treating it as "logged out".
      } catch {
        // Network error — also worth retrying.
      }
      if (attempt < REFRESH_RETRIES) await sleep(REFRESH_RETRY_DELAY_MS);
    }
    // Exhausted retries without a definitive answer. Don't clear an
    // already-known user just because this one check failed — only report
    // a connection error so the UI can offer a retry instead of bouncing
    // to the login page.
    setAuthError(true);
    setIsLoading(false);
    return null;
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          return { ok: false, error: data.error || "Invalid email or password" };
        }
        const me = await refresh();
        if (!me) {
          return {
            ok: false,
            error:
              "Your password was correct, but we couldn't confirm your session afterward. This can happen if your browser is blocking cookies (try a different browser or turning off strict tracking protection for this site) or if the server is briefly unreachable — try signing in again.",
          };
        }
        return { ok: true };
      } catch {
        return { ok: false, error: "Could not reach the server. Try again." };
      }
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    try {
      await fetch(`${BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, authError, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAppAuth() {
  return useContext(AuthContext);
}
