import React, { createContext, useCallback, useContext, useState, useEffect, useMemo, useRef, ReactNode } from 'react';
import {
  AgriHubApi,
  ApiError,
  getApiBaseUrl,
  hasConfiguredBackend,
  isDemoModeEnabled,
  setApiBaseUrl
} from '../api';
import { INITIAL_USERS } from '../mockData';
import { ensureOfflineDbSeeded, offlineDb } from '../lib/offlineDb';
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

function getEffectiveDemoAccounts(): DemoAccount[] {
  const byEmail = new Map<string, DemoAccount>();
  for (const acc of BUILTIN_DEMO_ACCOUNTS) {
    byEmail.set(acc.email.toLowerCase(), acc);
  }
  for (const extra of readExtraDemoUsers()) {
    if (extra?.email) {
      byEmail.set(extra.email.toLowerCase(), extra);
    }
  }
  return Array.from(byEmail.values());
}

function normalizeVerificationRef(value: string): string {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
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
  resetPassword: (payload: {
    email?: string;
    verification_ref?: string;
    current_password?: string;
    new_password: string;
  }) => Promise<{ success: boolean; message: string }>;
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
  const [loadingUser, setLoadingUser] = useState<boolean>(() => hasConfiguredBackend());
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => !hasConfiguredBackend() && isDemoModeEnabled());
  const [backendMessage, setBackendMessage] = useState<string>('Checking session...');
  const [apiUrl, setApiUrlState] = useState<string>(getApiBaseUrl());

  const sessionVersionRef = useRef<number>(0);

  const checkConnection = useCallback(async () => {
    const startVersion = sessionVersionRef.current;
    const isInitialLoad = currentUser === null && backendConnected === null;
    if (isInitialLoad && hasConfiguredBackend()) {
      setLoadingUser(true);
    }
    localStorage.removeItem('agrihub_user');

    if (!hasConfiguredBackend()) {
      setBackendConnected(false);
      const savedSession = readPersistedSession() || readDemoSession();
      if (isDemoModeEnabled()) {
        setIsDemoMode(true);
        setBackendMessage('Local mode active');
        if (sessionVersionRef.current === startVersion) {
          const restored = applySavedProfileToUser(savedSession);
          setCurrentUser(restored);
          if (restored) writePersistedSession(restored);
        }
      } else {
        setIsDemoMode(false);
        setBackendMessage('Backend API URL is not configured.');
        if (sessionVersionRef.current === startVersion) {
          setCurrentUser(savedSession);
        }
      }
      setLoadingUser(false);
      return;
    }

    try {
      const meRes = await AgriHubApi.getMe();
      if (sessionVersionRef.current !== startVersion) return;
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
      if (sessionVersionRef.current !== startVersion) return;
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
    const allDemo = getEffectiveDemoAccounts();
    const match = allDemo.find(
      (acc) => acc.email.toLowerCase() === normalized && acc.passwords.includes(password)
    );
    if (!match) return null;

    sessionVersionRef.current += 1;
    try {
      sessionStorage.removeItem('agrihub_admin_signed_out');
    } catch {
      // Ignore storage errors
    }

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
    setLoadingUser(false);
    setIsDemoMode(true);
    return userPayload;
  }, []);

  const loginDemoRole = useCallback((role: 'admin' | 'farmer' | 'supplier' | 'buyer') => {
    sessionVersionRef.current += 1;
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
    setLoadingUser(false);
    setIsDemoMode(true);
    return userPayload;
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<any | null> => {
    sessionVersionRef.current += 1;
    try {
      sessionStorage.removeItem('agrihub_admin_signed_out');
    } catch {
      // Ignore storage errors
    }
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
          setLoadingUser(false);
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
        // If MySQL only seeded admin@agrihub.local and user signed in with local admin@agrihub.com credentials,
        // allow local admin mode instead of locking out the frontend Admin Panel.
        if (isDemoModeEnabled() && email.trim().toLowerCase() === 'admin@agrihub.com') {
          const localAdmin = authenticateDemoAccount(email, password);
          if (localAdmin) {
            setBackendConnected(true);
            setBackendMessage('Local admin active (sign in via Sync Bar for MySQL sync)');
            return localAdmin;
          }
        }
        // Real backend rejected credentials -> propagate error without bypassing
        setBackendConnected(true);
        setIsDemoMode(false);
        setBackendMessage('Service online');
        setCurrentUser(null);
        throw err;
      }

      // Network / 404 / 5xx / Backend temporarily unreachable -> allow Local-First fallback if enabled
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

  const resetPassword = useCallback(
    async (payload: {
      email?: string;
      verification_ref?: string;
      current_password?: string;
      new_password: string;
    }): Promise<{ success: boolean; message: string }> => {
      if (hasConfiguredBackend()) {
        try {
          const res = await AgriHubApi.resetPassword(payload);
          if (res.success) {
            return {
              success: true,
              message: res.message || 'Password updated successfully.'
            };
          }
          return {
            success: false,
            message: res.message || 'Password reset failed.'
          };
        } catch (err: any) {
          if (err instanceof ApiError && err.isHttpError && err.status !== 503 && err.status !== 404) {
            throw err;
          }
          if (!isDemoModeEnabled()) {
            throw err;
          }
        }
      }

      if (!isDemoModeEnabled()) {
        return {
          success: false,
          message: 'Password reset service is currently unavailable.'
        };
      }

      await ensureOfflineDbSeeded();
      const offlineUsers = await offlineDb.users.toArray();
      const allAccounts = getEffectiveDemoAccounts();

      if (currentUser && payload.current_password !== undefined) {
        const activeEmail = String(currentUser.email || '').trim().toLowerCase();
        const existingAccount = allAccounts.find(
          (acc) => acc.email.toLowerCase() === activeEmail
        );
        if (existingAccount && !existingAccount.passwords.includes(payload.current_password)) {
          return {
            success: false,
            message: 'Current password is incorrect.'
          };
        }
        const updatedAccount: DemoAccount = existingAccount
          ? { ...existingAccount, passwords: [payload.new_password] }
          : {
              id: Number(currentUser.id || 1),
              role: (currentUser.role || 'buyer') as DemoAccount['role'],
              full_name: currentUser.full_name || 'AgriHub Member',
              email: activeEmail || 'member@agrihub.local',
              phone: currentUser.phone || '+880 1700-000000',
              business_name: currentUser.business_name || 'AgriHub Partner',
              address: currentUser.address || 'Dhaka Trade Corridor',
              is_verified: Boolean(currentUser.is_verified ?? true),
              passwords: [payload.new_password]
            };
        saveExtraDemoUser(updatedAccount);
        return {
          success: true,
          message: 'Password updated successfully. Your new password is active.'
        };
      }

      const normalizedEmail = String(payload.email || '').trim().toLowerCase();
      const normalizedRef = normalizeVerificationRef(payload.verification_ref || '');
      if (!normalizedEmail || !normalizedRef) {
        return {
          success: false,
          message: 'Email and phone number or Trade License / NID are required.'
        };
      }

      const demoMatch = allAccounts.find((acc) => acc.email.toLowerCase() === normalizedEmail);
      const offlineMatch = offlineUsers.find(
        (u) => String(u.email || '').trim().toLowerCase() === normalizedEmail
      );

      const candidate = demoMatch || (offlineMatch
        ? {
            id: Number(offlineMatch.id),
            role: offlineMatch.role as DemoAccount['role'],
            full_name: offlineMatch.full_name,
            email: offlineMatch.email,
            phone: offlineMatch.phone,
            business_name: offlineMatch.business_name,
            address: offlineMatch.address,
            is_verified: Boolean(offlineMatch.is_verified),
            passwords: ['Password123!']
          }
        : null);

      if (!candidate) {
        return {
          success: false,
          message: 'No registered account found for that email address.'
        };
      }

      const refMatches = [
        candidate.phone,
        candidate.business_name,
        offlineMatch?.phone,
        offlineMatch?.tax_or_nid_no
      ]
        .map((v) => normalizeVerificationRef(v || ''))
        .filter(Boolean);

      if (!refMatches.some((ref) => ref === normalizedRef || ref.endsWith(normalizedRef) || normalizedRef.endsWith(ref))) {
        return {
          success: false,
          message: 'Verification phone number or Trade License / NID does not match our records.'
        };
      }

      saveExtraDemoUser({
        ...candidate,
        passwords: [payload.new_password]
      });

      return {
        success: true,
        message: 'Password updated successfully. You can now sign in with your new password.'
      };
    },
    [currentUser]
  );

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
      resetPassword,
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
      resetPassword,
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
