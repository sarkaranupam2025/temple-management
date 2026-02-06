import { useState, useEffect, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone?: string;
  language?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const token = localStorage.getItem('tms_token');
    const userStr = localStorage.getItem('tms_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        setState({ user, token, isAuthenticated: true, isLoading: false });
      } catch {
        localStorage.removeItem('tms_token');
        localStorage.removeItem('tms_user');
        setState(s => ({ ...s, isLoading: false }));
      }
    } else {
      setState(s => ({ ...s, isLoading: false }));
    }
  }, []);

  const login = useCallback((user: User, token: string) => {
    localStorage.setItem('tms_token', token);
    localStorage.setItem('tms_user', JSON.stringify(user));
    setState({ user, token, isAuthenticated: true, isLoading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('tms_token');
    localStorage.removeItem('tms_user');
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
  }, []);

  const isAdmin = state.user?.role && ['SUPER_ADMIN', 'TEMPLE_ADMIN', 'TRUSTEE', 'MANAGER'].includes(state.user.role);

  return { ...state, login, logout, isAdmin };
}
