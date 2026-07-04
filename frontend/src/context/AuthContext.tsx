import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';
import type { ApiError } from '../utils/api';

export type UserRole = 'tenant' | 'owner' | 'admin';

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (phone: string, passwordHash: string) => Promise<void>;
  register: (data: {
    name: string;
    phone: string;
    email?: string;
    passwordHash: string;
    role: UserRole;
  }) => Promise<{ message: string }>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  setErrorMsg: (msg: string | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);
  const setErrorMsg = (msg: string | null) => setError(msg);

  // Initialize: fetch user details from cookies
  const fetchCurrentUser = async () => {
    try {
      setLoading(true);
      const data = await api.get<{ user: User }>('/auth/me');
      setUser(data.user);
    } catch (err) {
      // Not logged in or invalid cookie, clear user session silently
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  const login = async (phone: string, passwordHash: string) => {
    try {
      setError(null);
      setLoading(true);
      const data = await api.post<{ user: User }>('/auth/login', { phone, password: passwordHash });
      setUser(data.user);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (data: {
    name: string;
    phone: string;
    email?: string;
    passwordHash: string;
    role: UserRole;
  }) => {
    try {
      setError(null);
      setLoading(true);
      const result = await api.post<{ message: string }>('/auth/register', {
        name: data.name,
        phone: data.phone,
        email: data.email,
        password: data.passwordHash,
        role: data.role,
      });
      return result;
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (phone: string, code: string) => {
    try {
      setError(null);
      setLoading(true);
      await api.post('/auth/verify-otp', { phone, code });
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await api.post('/auth/logout');
      setUser(null);
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        login,
        register,
        verifyOtp,
        logout,
        clearError,
        setErrorMsg,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
