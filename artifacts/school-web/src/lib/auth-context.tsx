import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: "admin" | "teacher" | "student" | "parent";
  studentId?: number | null;
  teacherId?: number | null;
  [key: string]: any;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => ({ ok: false }),
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/users/me`, { credentials: "include" });
      if (res.ok) {
        setUser(await res.json());
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
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
        await refresh();
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
