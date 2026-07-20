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
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<AuthUser | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => ({ ok: false }),
  logout: async () => {},
  refresh: async () => null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/users/me`, { credentials: "include" });
      if (res.ok) {
        const me = await res.json();
        setUser(me);
        return me;
      } else {
        setUser(null);
        return null;
      }
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
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
              "Your password was correct, but your browser blocked staying signed in (this can happen with strict privacy/cookie settings). Try a different browser, or turn off enhanced/strict tracking protection for this site.",
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
    <AuthContext.Provider value={{ user, isLoading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAppAuth() {
  return useContext(AuthContext);
}
