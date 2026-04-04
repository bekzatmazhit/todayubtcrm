import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export type UserRole = "admin" | "umo_head" | "teacher";

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  permissions?: string[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateAvatar: (avatar_url: string | null) => void;
  hasPermission: (key: string) => boolean;
  getToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API_BASE = import.meta.env.VITE_API_URL || "/api";

/** Get stored JWT token */
export function getAuthToken(): string | null {
  return localStorage.getItem("today_crm_token");
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem("today_crm_user");
    return saved ? JSON.parse(saved) : null;
  });

  const getToken = useCallback(() => getAuthToken(), []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Login failed");
    }

    const userData = await response.json();
    const user: User = {
      id: userData.id,
      email: userData.email,
      full_name: userData.full_name,
      role: userData.role as UserRole,
      avatar_url: userData.avatar_url || undefined,
    };

    // Store JWT token
    if (userData.token) {
      localStorage.setItem("today_crm_token", userData.token);
    }

    setUser(user);
    localStorage.setItem("today_crm_user", JSON.stringify(user));
    localStorage.setItem("today_crm_last_login", JSON.stringify({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      timestamp: Date.now(),
    }));
  }, []);

  const logout = useCallback(() => {
    const token = getAuthToken();
    fetch(`${API_BASE}/logout`, {
      method: "POST",
      headers: token ? { "Authorization": `Bearer ${token}` } : {},
    }).catch(() => {});

    setUser(null);
    localStorage.removeItem("today_crm_user");
    localStorage.removeItem("today_crm_token");
  }, []);

  const updateAvatar = useCallback((avatar_url: string | null) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, avatar_url: avatar_url || undefined };
      localStorage.setItem("today_crm_user", JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Load permissions on login
  useEffect(() => {
    if (!user || user.permissions) return;
    const token = getAuthToken();
    fetch(`${API_BASE}/users/${user.id}/permissions`, {
      headers: token ? { "Authorization": `Bearer ${token}` } : {},
    })
      .then(res => res.ok ? res.json() : [])
      .then((perms: string[]) => {
        setUser(prev => {
          if (!prev) return prev;
          const updated = { ...prev, permissions: perms };
          localStorage.setItem("today_crm_user", JSON.stringify(updated));
          return updated;
        });
      })
      .catch(() => {});
  }, [user?.id]);

  const hasPermission = useCallback((key: string) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    return user.permissions?.includes(key) ?? false;
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, updateAvatar, hasPermission, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
