/**
 * AgriHub Frontend API Client
 * Connects React frontend to the configurable PHP/MySQL backend API
 * (supports local development, Vercel + Render/Railway/Hostinger, and Offline-First Sandbox)
 */

const STORAGE_KEY_API_BASE = 'agrihub_api_base';
const LEGACY_STORAGE_KEY_API_URL = 'agrihub_api_url';

function normalizeApiBase(raw?: string | null): string {
  if (!raw) return '';
  const cleaned = raw.trim().replace(/\/+$/, '');
  if (!cleaned) return '';
  if (/^https?:\/\//i.test(cleaned) || cleaned.startsWith('/')) {
    return cleaned;
  }
  return '';
}

const rawEnvApiBase =
  (import.meta.env.NEXT_PUBLIC_API_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE_URL as string | undefined);

const envApiBase = normalizeApiBase(rawEnvApiBase);

const isLocalBrowserHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

function isBlockedLoopbackOnRemoteHttps(url: string): boolean {
  if (!url || typeof window === 'undefined') return false;
  return (
    window.location.protocol === 'https:' &&
    !isLocalBrowserHost &&
    /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url)
  );
}

const DEFAULT_API_BASE =
  envApiBase && !isBlockedLoopbackOnRemoteHttps(envApiBase)
    ? envApiBase
    : import.meta.env.DEV && isLocalBrowserHost
    ? 'http://localhost/agrihub/api'
    : '';

export function getDefaultApiBaseUrl(): string {
  return DEFAULT_API_BASE;
}

export function getApiBaseUrl(): string {
  try {
    const current = normalizeApiBase(localStorage.getItem(STORAGE_KEY_API_BASE));
    if (current) {
      if (isBlockedLoopbackOnRemoteHttps(current)) {
        localStorage.removeItem(STORAGE_KEY_API_BASE);
      } else {
        return current;
      }
    }
    // Cleanly migrate any legacy override saved under `agrihub_api_url`
    const legacy = normalizeApiBase(localStorage.getItem(LEGACY_STORAGE_KEY_API_URL));
    if (legacy) {
      localStorage.removeItem(LEGACY_STORAGE_KEY_API_URL);
      if (!isBlockedLoopbackOnRemoteHttps(legacy) && !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(legacy)) {
        localStorage.setItem(STORAGE_KEY_API_BASE, legacy);
        return legacy;
      }
    }
  } catch {
    // Ignore storage read issues
  }
  return DEFAULT_API_BASE;
}

export function setApiBaseUrl(url: string): void {
  const cleaned = normalizeApiBase(url);
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY_API_URL);
    if (!cleaned || isBlockedLoopbackOnRemoteHttps(cleaned)) {
      localStorage.removeItem(STORAGE_KEY_API_BASE);
      return;
    }
    localStorage.setItem(STORAGE_KEY_API_BASE, cleaned);
  } catch {
    // Ignore storage write issues
  }
}

export function hasConfiguredBackend(): boolean {
  return Boolean(getApiBaseUrl());
}

export function isDemoModeEnabled(): boolean {
  const flag = (import.meta.env.VITE_ENABLE_DEMO_MODE as string | undefined)?.trim().toLowerCase();
  if (flag === 'false' || flag === '0') {
    return false;
  }
  return true;
}

export function resolveChatApiUrl(): string {
  const configured = (import.meta.env.VITE_CHAT_API_URL as string | undefined)?.trim();
  return configured ? configured.replace(/\/+$/, '') : '/api/chat';
}

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T;
  timestamp?: string;
}

export interface AdminCategoryStat {
  id: number;
  name: string;
  product_count: number;
  total_stock_units: number;
}

export interface AuditLogRecord {
  id: number;
  action: string;
  ip_address: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
  } | null;
  details: Record<string, any> | null;
  created_at: string;
}

export interface AdminStatsData {
  users: {
    total: number;
    verified_total?: number;
    by_role: Record<string, number>;
    verified_farmers: number;
    farmer_kyc_pct: number;
  };
  products: {
    total_active: number;
    total_stock_units: number;
    total_inventory_value?: number;
    low_stock_count?: number;
  };
  orders: {
    total_count: number;
    pending_orders?: number;
    total_gmv: number;
    total_revenue?: number;
    paid_revenue?: number;
    escrow_revenue?: number;
  };
  logistics: {
    active_shipments: number;
    delivered_shipments?: number;
    delayed_shipments?: number;
    total_shipments?: number;
  };
  categories?: AdminCategoryStat[];
  recent_activity?: AuditLogRecord[];
}

export interface AdminCategoryRecord {
  id: number;
  name: string;
  slug: string;
  description: string;
  created_at: string;
  product_count: number;
  total_stock_units: number;
}

export interface AdminCategoryPayload {
  id?: number;
  name: string;
  slug?: string;
  description?: string;
}

export interface AdminProductPayload {
  id?: number;
  title: string;
  category_id: number;
  farmer_id?: number;
  batch_number?: string;
  harvest_date?: string | null;
  expiry_date?: string | null;
  unit_price: number;
  unit_type: 'kg' | 'ton' | 'bag' | 'crate' | 'liter' | 'box' | string;
  quantity_available: number;
  storage_temp_celsius?: number | null;
  is_organic?: boolean;
  status?: 'active' | 'low_stock' | 'out_of_stock' | 'archived' | string;
  image_url?: string;
}

export class ApiError extends Error {
  status?: number;
  isNetworkError: boolean;
  isHttpError: boolean;
  data?: any;

  constructor(
    message: string,
    options: { status?: number; isNetworkError?: boolean; isHttpError?: boolean; data?: any } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.isNetworkError = Boolean(options.isNetworkError);
    this.isHttpError = Boolean(options.isHttpError);
    this.data = options.data;
  }
}

/**
 * Universal fetch wrapper for AgriHub PHP endpoints
 * Sends credentials for cross-origin PHP sessions and optional idempotency keys for offline sync
 */
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const base = getApiBaseUrl();
  if (!base) {
    throw new ApiError(
      'Backend API URL is not configured. Operating in Offline-First Sandbox mode.',
      { isNetworkError: true, isHttpError: false }
    );
  }

  const url = `${base}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...((options.headers as Record<string, string>) || {})
  };

  if (/\.ngrok(-free)?\.(app|dev|io)\b/i.test(base) && !headers['ngrok-skip-browser-warning']) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  if (options.body && typeof options.body === 'string' && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      credentials: 'include'
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new ApiError(`Connection timed out contacting API server at ${base}.`, {
        isNetworkError: true,
        isHttpError: false
      });
    }

    const isHttpsToLocalHttp =
      typeof window !== 'undefined' &&
      window.location.protocol === 'https:' &&
      /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(base);

    const networkMessage = isHttpsToLocalHttp
      ? `Blocked mixed-content request to ${base} from HTTPS origin (${window.location.origin}). Configure an HTTPS backend URL via VITE_API_BASE_URL or NEXT_PUBLIC_API_URL.`
      : `Cannot reach backend API at ${base}. Operating in Offline-First mode.`;

    throw new ApiError(networkMessage, { isNetworkError: true, isHttpError: false });
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await response.text();
  let json: ApiResponse<T>;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError(`Invalid JSON response from API server (HTTP ${response.status})`, {
      status: response.status,
      isHttpError: true,
      isNetworkError: false
    });
  }

  if (response.status === 503 || (json as any)?.code === 'BACKEND_OFFLINE') {
    throw new ApiError(json.message || 'Backend API or database is temporarily unavailable.', {
      status: response.status,
      isHttpError: true,
      isNetworkError: false,
      data: json
    });
  }

  if (!response.ok) {
    throw new ApiError(json.message || `HTTP ${response.status} error from API server`, {
      status: response.status,
      isHttpError: true,
      isNetworkError: false,
      data: json
    });
  }

  return json;
}

export const AgriHubApi = {
  // Health & Session Reachability Check
  async checkConnection(): Promise<{ connected: boolean; message: string; version?: string }> {
    if (!hasConfiguredBackend()) {
      return { connected: false, message: 'Offline-First Demo Mode (No API URL configured)' };
    }
    try {
      await apiFetch<any>('/auth/me.php', { method: 'GET' });
      return { connected: true, message: 'Service online' };
    } catch (e: any) {
      if (e instanceof ApiError && e.isHttpError && e.status !== 503) {
        // HTTP 401 ("Not authenticated") confirms the backend API & DB are reachable
        return { connected: true, message: 'Service online' };
      }
      return { connected: false, message: e.message || 'Service unavailable' };
    }
  },

  // Auth Endpoints
  async getMe() {
    return apiFetch<any>('/auth/me.php', { method: 'GET' });
  },

  async login(email: string, password: string) {
    return apiFetch<any>('/auth/login.php', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  async register(data: {
    full_name: string;
    email: string;
    password: string;
    role: string;
    phone?: string;
    business_name?: string;
    address?: string;
  }) {
    return apiFetch<any>('/auth/register.php', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async logout() {
    return apiFetch<any>('/auth/logout.php', { method: 'POST' });
  },

  async resetPassword(data: {
    email?: string;
    verification_ref?: string;
    current_password?: string;
    new_password: string;
  }) {
    return apiFetch<any>('/auth/reset_password.php', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Products & Categories
  async getCategories() {
    return apiFetch<any[]>('/products/categories.php', { method: 'GET' });
  },

  async getProducts(params?: { category_id?: number; farmer_id?: number; status?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.category_id) query.append('category_id', String(params.category_id));
    if (params?.farmer_id) query.append('farmer_id', String(params.farmer_id));
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<any[]>(`/products/index.php${qs}`, { method: 'GET' });
  },

  async createProduct(data: {
    title: string;
    category_id: number;
    batch_number?: string;
    harvest_date?: string;
    unit_price: number;
    unit_type: string;
    quantity_available: number;
    storage_temp_celsius?: number;
    is_organic?: boolean;
    image_url?: string;
  }) {
    return apiFetch<any>('/products/create.php', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Orders
  async getOrders() {
    return apiFetch<any[]>('/orders/index.php', { method: 'GET' });
  },

  async createOrder(data: {
    items: { product_id: number; quantity: number }[];
    delivery_address: string;
    notes?: string;
  }, idempotencyKey?: string) {
    return apiFetch<any>('/orders/create.php', {
      method: 'POST',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(data)
    });
  },

  async updateOrderStatus(orderId: number, status: string, idempotencyKey?: string) {
    return apiFetch<any>('/orders/update_status.php', {
      method: 'POST',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify({ order_id: orderId, status })
    });
  },

  // Logistics
  async getShipments() {
    return apiFetch<any[]>('/logistics/index.php', { method: 'GET' });
  },

  async createShipment(data: {
    order_id: number;
    supplier_id?: number;
    origin_hub: string;
    destination_hub: string;
    vehicle_number?: string;
    driver_name?: string;
    driver_phone?: string;
    temperature_celsius?: number;
  }, idempotencyKey?: string) {
    return apiFetch<any>('/logistics/create.php', {
      method: 'POST',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(data)
    });
  },

  async updateShipment(data: {
    shipment_id: number;
    status?: string;
    temperature_celsius?: number;
  }, idempotencyKey?: string) {
    return apiFetch<any>('/logistics/update.php', {
      method: 'POST',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(data)
    });
  },

  async track(trackingCode: string) {
    return apiFetch<any>(`/logistics/track.php?code=${encodeURIComponent(trackingCode)}`, { method: 'GET' });
  },

  // Admin
  async getAdminStats() {
    return apiFetch<AdminStatsData>('/admin/stats.php', { method: 'GET' });
  },

  async getAuditLogs(limit = 50) {
    return apiFetch<AuditLogRecord[]>(`/admin/audit_logs.php?limit=${limit}`, { method: 'GET' });
  },

  async getUsers(params?: { role?: string; search?: string }) {
    const query = new URLSearchParams();
    if (params?.role) query.append('role', params.role);
    if (params?.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<any[]>(`/admin/users.php${qs}`, { method: 'GET' });
  },

  async createUser(data: {
    full_name: string;
    email: string;
    password?: string;
    role: string;
    phone?: string;
    business_name?: string;
    tax_or_nid_no?: string;
    address?: string;
    is_verified?: boolean;
  }, idempotencyKey?: string) {
    return apiFetch<any>('/admin/users.php', {
      method: 'POST',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(data)
    });
  },

  async updateUser(data: {
    id: number;
    full_name: string;
    role: string;
    phone?: string;
    business_name?: string;
    tax_or_nid_no?: string;
    address?: string;
    is_verified?: boolean;
  }, idempotencyKey?: string) {
    return apiFetch<any>('/admin/users.php', {
      method: 'PUT',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(data)
    });
  },

  async updateUserVerification(userId: number, isVerified: boolean, idempotencyKey?: string) {
    return apiFetch<any>('/admin/users.php', {
      method: 'PATCH',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify({ user_id: userId, is_verified: isVerified })
    });
  },

  async deleteUser(id: number, idempotencyKey?: string) {
    return apiFetch<{ id: number }>(`/admin/users.php?id=${id}`, {
      method: 'DELETE',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined
    });
  },

  // Admin Categories CRUD
  async getAdminCategories(params?: { search?: string }) {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<AdminCategoryRecord[]>(`/admin/categories.php${qs}`, { method: 'GET' });
  },

  async createCategory(data: AdminCategoryPayload, idempotencyKey?: string) {
    return apiFetch<AdminCategoryRecord>('/admin/categories.php', {
      method: 'POST',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(data)
    });
  },

  async updateCategory(data: AdminCategoryPayload & { id: number }, idempotencyKey?: string) {
    return apiFetch<AdminCategoryRecord>('/admin/categories.php', {
      method: 'PUT',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(data)
    });
  },

  async deleteCategory(id: number, idempotencyKey?: string) {
    return apiFetch<{ id: number }>(`/admin/categories.php?id=${id}`, {
      method: 'DELETE',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined
    });
  },

  // Admin Products CRUD
  async getAdminProducts(params?: {
    search?: string;
    category_id?: number;
    farmer_id?: number;
    status?: string;
    is_organic?: boolean;
  }) {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.category_id) query.append('category_id', String(params.category_id));
    if (params?.farmer_id) query.append('farmer_id', String(params.farmer_id));
    if (params?.status) query.append('status', params.status);
    if (params?.is_organic !== undefined) query.append('is_organic', params.is_organic ? '1' : '0');
    const qs = query.toString() ? `?${query.toString()}` : '';
    return apiFetch<any[]>(`/admin/products.php${qs}`, { method: 'GET' });
  },

  async createAdminProduct(data: AdminProductPayload, idempotencyKey?: string) {
    return apiFetch<any>('/admin/products.php', {
      method: 'POST',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(data)
    });
  },

  async updateAdminProduct(data: AdminProductPayload & { id: number }, idempotencyKey?: string) {
    return apiFetch<any>('/admin/products.php', {
      method: 'PUT',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(data)
    });
  },

  async deleteAdminProduct(id: number, idempotencyKey?: string) {
    return apiFetch<{ id: number }>(`/admin/products.php?id=${id}`, {
      method: 'DELETE',
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : undefined
    });
  }
};
