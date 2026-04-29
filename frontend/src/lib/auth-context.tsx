import { createContext, useContext, useMemo } from 'react';

import type { Teacher } from './types';

/**
 * Stub Auth provider.
 *
 * The original React frontend was built against a JWT-protected backend
 * that exposed `/auth/me`, `/auth/login`, etc. Our spec-compliant backend
 * (4-table model) does not have authentication, so we expose a fake
 * "always logged in" teacher and turn signIn/signOut into no-ops. This
 * keeps every page in the app working without modifying their imports.
 */
const FAKE_TEACHER: Teacher = {
  id: 1,
  email: 'demo@smartattend.local',
  name: 'Demo Hoca',
  created_at: new Date().toISOString(),
};

type AuthState = {
  teacher: Teacher | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
  refresh: () => Promise<void>;
  setTeacher: (t: Teacher | null) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<AuthState>(
    () => ({
      teacher: FAKE_TEACHER,
      loading: false,
      signIn: async () => {
        // no-op: backend has no auth
      },
      signUp: async () => {
        // no-op: backend has no auth
      },
      signOut: () => {
        // no-op
      },
      refresh: async () => {
        // no-op
      },
      setTeacher: () => {
        // no-op
      },
    }),
    [],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
