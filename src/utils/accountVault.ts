import type { OrderItem } from '../mockData';
import type { CheckoutCartItem } from './pricing';

const ACTIVE_SESSION_KEY = 'agrihub_active_session_v1';
const ACCOUNT_VAULT_KEY = 'agrihub_account_vault_v1';

export interface SavedUserProfile {
  full_name: string;
  phone?: string;
  business_name?: string;
  address?: string;
  email?: string;
}

export interface SavedCheckoutInfo {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
}

export interface AccountSnapshot {
  profile?: SavedUserProfile;
  cartItems?: CheckoutCartItem[];
  orders?: OrderItem[];
  checkoutInfo?: SavedCheckoutInfo;
  updatedAt: string;
}

export function getAccountVaultKey(user: { email?: string; id?: number | string } | null | undefined): string | null {
  if (!user) return null;
  const email = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
  if (email) return email;
  if (user.id !== undefined && user.id !== null) return `id:${String(user.id)}`;
  return null;
}

export function readPersistedSession(): any | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function writePersistedSession(user: any | null): void {
  try {
    if (!user) {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(user));
  } catch {
    // Ignore storage issues
  }
}

function readAllVaults(): Record<string, AccountSnapshot> {
  try {
    const raw = localStorage.getItem(ACCOUNT_VAULT_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function loadAccountSnapshot(user: { email?: string; id?: number | string } | null | undefined): AccountSnapshot | null {
  const key = getAccountVaultKey(user);
  if (!key) return null;
  const vaults = readAllVaults();
  return vaults[key] || null;
}

export function saveAccountSnapshot(
  user: { email?: string; id?: number | string } | null | undefined,
  partial: Partial<Omit<AccountSnapshot, 'updatedAt'>>
): void {
  const key = getAccountVaultKey(user);
  if (!key) return;
  try {
    const vaults = readAllVaults();
    const existing = vaults[key] || { updatedAt: new Date().toISOString() };
    vaults[key] = {
      ...existing,
      ...partial,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(ACCOUNT_VAULT_KEY, JSON.stringify(vaults));
  } catch {
    // Ignore storage quota issues
  }
}

export function applySavedProfileToUser<T extends Record<string, any>>(user: T | null): T | null {
  if (!user) return null;
  const snapshot = loadAccountSnapshot(user);
  if (!snapshot?.profile) return user;
  return {
    ...user,
    full_name: snapshot.profile.full_name || user.full_name,
    phone: snapshot.profile.phone ?? user.phone,
    business_name: snapshot.profile.business_name ?? user.business_name,
    address: snapshot.profile.address ?? user.address
  };
}
