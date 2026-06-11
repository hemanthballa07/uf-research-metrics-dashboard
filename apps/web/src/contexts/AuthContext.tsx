import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { getToken, setToken, clearToken, isAuthenticated } from '../lib/auth.js';

interface AuthContextValue {
  isLoggedIn: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(isAuthenticated);

  const login = useCallback((token: string) => {
    setToken(token);
    setIsLoggedIn(true);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setIsLoggedIn(false);
  }, []);

  return (
    <AuthContext.Provider value={{ isLoggedIn, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { getToken };
