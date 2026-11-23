import React, { createContext, useCallback, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  AgriHubApi,
  ApiError,
  getApiBaseUrl,
  hasConfiguredBackend,
  isDemoModeEnabled,
  setApiBaseUrl
} from '../api';
import { INITIAL_USERS } from '../mockData';
import {
  applySavedProfileToUser,
  readPersistedSession,
  saveAccountSnapshot,
  writePersistedSession
} from '../utils/accountVault';

const DEMO_SESSION_KEY = 'agrihub_demo_session';
const DEMO_REGISTERED_USERS_KEY = 'agrihub_demo_users';

interface DemoAccount {
  id: number;
  role: 'admin' | 'farmer' | 'supplier' | 'buyer';
  full_name: string;
  email: string;
  phone: string;
  business_name: string;
  address: string;
  is_verified: boolean;
  passwords: string[];
}

const BUILTIN_DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: 1,
    role: 'admin',
    full_name: 'System Administrator',
    email: 'admin@agrihub.com',
    phone: '+880 1700-000001',
    business_name: 'AgriHub Central HQ',
    address: 'Dhaka Central Operations Centre',
    is_verified: true,
    passwords: ['agraiagrihb#1', 'Password123!']
  },
  {
    id: 1,
    role: 'admin',
    full_name: 'System Administrator',
    email: 'admin@agrihub.local',
    phone: '+880 1700-000001',
    business_name: 'AgriHub Central HQ',
    address: 'Dhaka Central Operations Centre',
    is_verified: true,
    passwords: ['Password123!', 'agraiagrihb#1']
  },
  ...INITIAL_USERS.filter((u) => u.role !== 'admin').map((u) => ({
    id: u.id,
    role: u.role,
    full_name: u.full_name,
    email: u.email,
    phone: u.phone,
    business_name: u.business_name,
    address: u.address,
    is_verified: u.is_verified,
    passwords: ['Password123!']
  }))
];

function readDemoSession(): any | null {
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDemoSession(user: any | null): void {
  try {
    if (!user) {
      localStorage.removeItem(DEMO_SESSION_KEY);
      return;
    }
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage issues
  }
}

function readExtraDemoUsers(): DemoAccount[] {
  try {
    const raw = localStorage.getItem(DEMO_REGISTERED_USERS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveExtraDemoUser(account: DemoAccount): void {
  try {
    const current = readExtraDemoUsers().filter(
      (u) => u.email.toLowerCase() !== account.email.toLowerCase()
    );
    localStorage.setItem(DEMO_REGISTERED_USERS_KEY, JSON.stringify([...current, account]));
  } catch {
    // Ignore storage issues
  }
}

interface AuthContextType {
  currentUser: any | null;
  setCurrentUser: (user: any | null) => void;
  loadingUser: boolean;
  backendConnected: boolean | null;
  isDemoMode: boolean;
  backendMessage: string;
  apiUrl: string;
  setApiUrl: (url: string) => void;
  checkConnection: () => Promise<void>;
  login: (email: string, password: string) => Promise<any | null>;
  loginDemoRole: (role: 'admin' | 'farmer' | 'supplier' | 'buyer') => any;
  register: (data: any) => Promise<boolean>;
  updateCurrentUserProfile: (updates: {
    full_name: string;
    phone?: string;
    business_name?: string;
    address?: string;
    email?: string;
  }) => Promise<any>;
  logout: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<any | null>(() => readPersistedSession() || readDemoSession());
  const [loadingUser, setLoadingUser] = useState<boolean>(true);
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [backendMessage, setBackendMessage] = useState<string>('Checking session...');
  const [apiUrl, setApiUrlState] = useState<string>(getApiBaseUrl());

  const checkConnection = useCallback(async () => {
    setLoadingUser(true);
    localStorage.removeItem('agrihub_user');

    if (!hasConfiguredBackend()) {
      setBackendConnected(false);
      const savedSession = readPersistedSession() || readDemoSession();
      if (isDemoModeEnabled()) {
        setIsDemoMode(true);
        setBackendMessage('Local mode active');
        const restored = applySavedProfileToUser(savedSession);
        setCurrentUser(restored);
        if (restored) writePersistedSession(restored);
      } else {
        setIsDemoMode(false);
        setBackendMessage('Backend API URL is not configured.');
        setCurrentUser(savedSession);
      }
      setLoadingUser(false);
      return;
    }

    try {
      const meRes = await AgriHubApi.getMe();
      setBackendConnected(true);
      setIsDemoMode(false);
      setBackendMessage('Service online');
      writeDemoSession(null);
      if (meRes.success && meRes.data) {
        const merged = applySavedProfileToUser(meRes.data);
        writePersistedSession(merged);
        setCurrentUser(merged);
      } else {
        writePersistedSession(null);
        setCurrentUser(null);
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.isHttpError && err.status !== 503) {
        setBackendConnected(true);
        const activeLocalSession = isDemoModeEnabled() ? (readDemoSession() || readPersistedSession()) : null;
        if (activeLocalSession && (activeLocalSession.is_demo || isDemoModeEnabled())) {
          setIsDemoMode(Boolean(activeLocalSession.is_demo));
          setBackendMessage(
            activeLocalSession.is_demo
              ? 'Service online (sign in required to sync)'
              : 'Service online'
          );
          const restored = applySavedProfileToUser(activeLocalSession);
          setCurrentUser(restored);
        } else {
          setIsDemoMode(false);
          setBackendMessage('Service online');
          writeDemoSession(null);
          writePersistedSession(null);
          setCurrentUser(null);
        }
      } else {
        setBackendConnected(false);
        const fallbackSession = readPersistedSession() || readDemoSession();
        if (isDemoModeEnabled()) {
          setIsDemoMode(true);
          setBackendMessage(err?.message || 'Local mode active');
          setCurrentUser(applySavedProfileToUser(fallbackSession));
        } else {
          setIsDemoMode(false);
          setBackendMessage(err?.message || 'Service unavailable');
          setCurrentUser(fallbackSession);
        }
      }
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const authenticateDemoAccount = useCallback((email: string, password: string): any | null => {
    const normalized = email.trim().toLowerCase();
    const allDemo = [...BUILTIN_DEMO_ACCOUNTS, ...readExtraDemoUsers()];
    const match = allDemo.find(
      (acc) => acc.email.toLowerCase() === normalized && acc.passwords.includes(password)
    );
    if (!match) return null;

    const userPayload = applySavedProfileToUser({
      id: match.id,
      role: match.role,
      full_name: match.full_name,
      email: match.email,
      phone: match.phone,
      business_name: match.business_name,
      address: match.address,
      is_verified: match.is_verified,
      is_demo: true
    });
    writeDemoSession(userPayload);
    writePersistedSession(userPayload);
    setCurrentUser(userPayload);
    setIsDemoMode(true);
    return userPayload;
  }, []);

  const loginDemoRole = useCallback((role: 'admin' | 'farmer' | 'supplier' | 'buyer') => {
    try {
      sessionStorage.removeItem('agrihub_admin_signed_out');
    } catch {
      // Ignore storage errors
    }
    const match = BUILTIN_DEMO_ACCOUNTS.find((acc) => acc.role === role) || BUILTIN_DEMO_ACCOUNTS[0];
    const userPayload = applySavedProfileToUser({
      id: match.id,
      role: match.role,
      full_name: match.full_name,
      email: match.email,
      phone: match.phone,
      business_name: match.business_name,
      address: match.address,
      is_verified: match.is_verified,
      is_demo: true
    });
    writeDemoSession(userPayload);
    writePersistedSession(userPayload);
    setCurrentUser(userPayload);
    setIsDemoMode(true);
    return userPayload;
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<any | null> => {
    try {
      sessionStorage.removeItem('agrihub_admin_signed_out');
    } catch {
      // Ignore storage errors
    }
    setLoadingUser(true);
    try {
      if (hasConfiguredBackend()) {
        const res = await AgriHubApi.login(email, password);
        if (res.success && res.data) {
          setBackendConnected(true);
          setIsDemoMode(false);
          setBackendMessage('Service online');
          writeDemoSession(null);
          const mergedUser = applySavedProfileToUser(res.data);
          writePersistedSession(mergedUser);
          setCurrentUser(mergedUser);
          return mergedUser;
        }
        writePersistedSession(null);
        setCurrentUser(null);
        return null;
      }

      if (isDemoModeEnabled()) {
        const demoUser = authenticateDemoAccount(email, password);
        if (demoUser) {
          setBackendConnected(false);
          setBackendMessage('Local mode active');
          return demoUser;
        }
      }

      setCurrentUser(null);
      return null;
    } catch (err: any) {
      const isAuthRejection =
        err instanceof ApiError &&
        err.isHttpError &&
        (err.status === 401 || err.status === 403 || err.status === 422);

      if (isAuthRejection) {
        // Real backend rejected credentials -> propagate error without bypassing
        setBackendConnected(true);
        setIsDemoMode(false);
        setBackendMessage('Service online');
        setCurrentUser(null);
        throw err;
      }

      // Network / 404 / 5xx / Backend temporarily unreachable -> allow Offline-First fallback if enabled
      setBackendConnected(false);
      if (isDemoModeEnabled()) {
        setIsDemoMode(true);
        const demoUser = authenticateDemoAccount(email, password);
        if (demoUser) {
          setBackendMessage('Local mode active');
          return demoUser;
        }
        setCurrentUser(null);
        return null;
      }

      setBackendMessage(err?.message || 'Service unavailable');
      setCurrentUser(null);
      throw err;
    } finally {
      setLoadingUser(false);
    }
  }, [authenticateDemoAccount]);

  const register = useCallback(async (data: any): Promise<boolean> => {
    setLoadingUser(true);
    try {
      if (hasConfiguredBackend()) {
        try {
          const res = await AgriHubApi.register(data);
          if (res.success) {
            const loginRes = await AgriHubApi.login(data.email, data.password);
            if (loginRes.success && loginRes.data) {
              setBackendConnected(true);
              setIsDemoMode(false);
              setBackendMessage('Service online');
              writeDemoSession(null);
              setCurrentUser(loginRes.data);
              return true;
            }
          }
          return false;
        } catch (err: any) {
          if (err instanceof ApiError && err.isHttpError && err.status !== 503) {
            throw err;
          }
          // Fall through to demo registration on network outage if enabled
          if (!isDemoModeEnabled()) throw err;
        }
      }

      if (isDemoModeEnabled()) {
        const newAccount: DemoAccount = {
          id: Math.floor(Date.now() % 1000000),
          role: (data.role || 'buyer') as DemoAccount['role'],
          full_name: data.full_name || 'AgriHub Member',
          email: String(data.email || '').trim().toLowerCase(),
          phone: data.phone || '+880 1700-000000',
          business_name: data.business_name || 'Agro Trade Partner',
          address: data.address || 'Dhaka Trade Corridor',
          is_verified: true,
          passwords: [data.password]
        };
        saveExtraDemoUser(newAccount);
        const userPayload = {
          id: newAccount.id,
          role: newAccount.role,
          full_name: newAccount.full_name,
          email: newAccount.email,
          phone: newAccount.phone,
          business_name: newAccount.business_name,
          address: newAccount.address,
          is_verified: true,
          is_demo: true
        };
        writeDemoSession(userPayload);
        writePersistedSession(userPayload);
        saveAccountSnapshot(userPayload, {
          profile: {
            full_name: userPayload.full_name,
            phone: userPayload.phone,
            business_name: userPayload.business_name,
            address: userPayload.address,
            email: userPayload.email
          }
        });
        setIsDemoMode(true);
        setCurrentUser(userPayload);
        return true;
      }

      return false;
    } finally {
      setLoadingUser(false);
    }
  }, []);

  const updateCurrentUserProfile = useCallback(
    async (updates: {
      full_name: string;
      phone?: string;
      business_name?: string;
      address?: string;
      email?: string;
    }) => {
      const nextUser = {
        ...(currentUser || { id: 1, role: 'admin', is_verified: true }),
        full_name: updates.full_name.trim(),
        phone: updates.phone?.trim() ?? currentUser?.phone ?? '',
        business_name: updates.business_name?.trim() ?? currentUser?.business_name ?? '',
        address: updates.address?.trim() ?? currentUser?.address ?? '',
        email: updates.email?.trim() ?? currentUser?.email ?? 'admin@agrihub.com'
      };

      setCurrentUser(nextUser);
      writePersistedSession(nextUser);
      saveAccountSnapshot(nextUser, {
        profile: {
          full_name: nextUser.full_name,
          phone: nextUser.phone,
          business_name: nextUser.business_name,
          address: nextUser.address,
          email: nextUser.email
        }
      });

      if (isDemoMode || nextUser.is_demo || !hasConfiguredBackend()) {
        writeDemoSession(nextUser);
      }

      // Sync update to backend if reachable, else offline cache keeps it updated
      if (hasConfiguredBackend() && backendConnected && nextUser.id) {
        try {
          await AgriHubApi.updateUser({
            id: Number(nextUser.id),
            full_name: nextUser.full_name,
            role: nextUser.role || 'admin',
            phone: nextUser.phone,
            business_name: nextUser.business_name,
            address: nextUser.address,
            is_verified: Boolean(nextUser.is_verified)
          });
        } catch {
          // Keep local profile updated even if offline
        }
      }

      return nextUser;
    },
    [backendConnected, currentUser, isDemoMode]
  );

  const logout = useCallback(async () => {
    try {
      if (hasConfiguredBackend() && backendConnected) {
        await AgriHubApi.logout();
      }
    } catch {
      // Clear local auth state even if backend call fails
    } finally {
      setCurrentUser(null);
      writePersistedSession(null);
      writeDemoSession(null);
      try {
        localStorage.removeItem('agrihub_user');
        localStorage.removeItem('agrihub_cart_v1');
        localStorage.removeItem('agrihub_orders_v1');
      } catch {
        // Ignore storage errors
      }
    }
  }, [backendConnected]);

  const setApiUrl = useCallback(
    (url: string) => {
      setApiBaseUrl(url);
      setApiUrlState(getApiBaseUrl());
      checkConnection();
    },
    [checkConnection]
  );

  const isAdmin = currentUser?.role === 'admin';

  const authValue = useMemo<AuthContextType>(
    () => ({
      currentUser,
      setCurrentUser,
      loadingUser,
      backendConnected,
      isDemoMode,
      backendMessage,
      apiUrl,
      setApiUrl,
      checkConnection,
      login,
      loginDemoRole,
      register,
      updateCurrentUserProfile,
      logout,
      isAdmin
    }),
    [
      currentUser,
      loadingUser,
      backendConnected,
      isDemoMode,
      backendMessage,
      apiUrl,
      setApiUrl,
      checkConnection,
      login,
      loginDemoRole,
      register,
      updateCurrentUserProfile,
      logout,
      isAdmin
    ]
  );

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
