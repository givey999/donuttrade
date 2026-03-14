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
} from '@/lib/api';

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }

    apiFetch<UserProfile>('/auth/me')
      .then((profile) => {
        setUser(profile);
      })
      .catch((err) => {
        if (err instanceof ApiError) {
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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        logout,
        refreshUser,
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
