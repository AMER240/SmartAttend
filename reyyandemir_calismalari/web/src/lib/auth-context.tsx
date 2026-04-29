import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { apiRequest, getToken, setToken, setUnauthorizedHandler } from './api';
import type { Teacher, TokenResponse } from './types';

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
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setTeacher(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiRequest<Teacher>('/auth/me');
      setTeacher(me);
    } catch {
      setToken(null);
      setTeacher(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null);
      setTeacher(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const form = new FormData();
    form.append('username', email);
    form.append('password', password);
    const data = await apiRequest<TokenResponse>('/auth/login', { formData: form });
    setToken(data.access_token);
    setTeacher(data.teacher);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const data = await apiRequest<TokenResponse>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    });
    setToken(data.access_token);
    setTeacher(data.teacher);
  }, []);

  const signOut = useCallback(() => {
    setToken(null);
    setTeacher(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ teacher, loading, signIn, signUp, signOut, refresh, setTeacher }),
    [teacher, loading, signIn, signUp, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
