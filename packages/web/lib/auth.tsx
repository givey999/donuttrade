'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useRouter } from 'next/navigation';
import type { UserProfile } from '@donuttrade/shared';
import {
  apiFetch,
  ApiError,
  getAccessToken,
  clearAccessToken,
  startImpersonation,
  stopImpersonation,
  getImpersonating,
  setAccessToken,
} from '@/lib/api';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  isTimedOut: boolean;
  impersonating: string | null;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  impersonate: (userId: string) => Promise<void>;
  stopImpersonating: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    // Restore impersonation state from localStorage
    setImpersonating(getImpersonating());

    apiFetch<UserProfile>('/auth/me')
      .then((profile) => {
        setUser(profile);
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          // If we were impersonating and the token expired, stop impersonating
          if (getImpersonating()) {
            stopImpersonation();
            setImpersonating(null);
            window.location.reload();
            return;
          }
          // Server explicitly rejected our credentials — clear token
          clearAccessToken();
          if (err.code === 'REFRESH_FAILED') {
            router.push('/login');
          }
        }
        // Network errors (TypeError, etc.) — keep token intact so the
        // user isn't logged out by a temporary connectivity blip
      })
      .finally(() => {
        setLoading(false);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshUser = useCallback(async () => {
    try {
      const profile = await apiFetch<UserProfile>('/auth/me');
      setUser(profile);
    } catch {
      // Silently fail — profile will be stale until next page load
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort — proceed with local cleanup even if API call fails
    }
    clearAccessToken();
    setUser(null);
    router.push('/login');
  }, [router]);

  const impersonateUser = useCallback(async (userId: string) => {
    const data = await apiFetch<{ accessToken: string; user: { id: string; username: string; role: string } }>(
      `/admin/impersonate/${userId}`,
      { method: 'POST', body: JSON.stringify({}) },
    );
    startImpersonation(data.accessToken, data.user.username || 'Unknown');
    setImpersonating(data.user.username || 'Unknown');
    // Reload to pick up the new user context everywhere
    window.location.href = '/';
  }, []);

  const handleStopImpersonating = useCallback(() => {
    stopImpersonation();
    setImpersonating(null);
    window.location.href = '/admin/users';
  }, []);

  const isTimedOut = !!(user?.timedOutUntil && new Date(user.timedOutUntil) > new Date());

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        isTimedOut,
        impersonating,
        logout,
        refreshUser,
        impersonate: impersonateUser,
        stopImpersonating: handleStopImpersonating,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return ctx;
}
