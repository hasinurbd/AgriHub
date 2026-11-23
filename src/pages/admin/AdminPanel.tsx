import React, { Suspense, lazy, useState, useEffect, useMemo } from 'react';
import {
  Sprout,
  Truck,
  ShieldCheck,
  ShoppingBag,
  Layers,
  Search,
  Plus,
  RefreshCw,
  UserCheck,
  LogIn,
  LogOut,
  Bell,
  Globe,
  ChevronDown,
  ChevronRight,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Thermometer,
  Calendar,
  X,
  SlidersHorizontal,
  ArrowUpRight,
  Menu,
  Apple,
  Wheat,
  Milk,
  Droplets,
  Carrot,
  Eye,
  Check,
  Copy,
  Users,
  MapPin,
  ExternalLink,
  ChevronLeft,
  Banknote,
  Activity,
  Pencil,
  Trash2,
  BarChart3,
  Settings,
  Warehouse,
  Download,
  FileText,
  FileDown,
  KeyRound,
  Store,
  UserPlus
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  AgriHubApi,
  AdminStatsData,
  AuditLogRecord,
  getApiBaseUrl,
  getDefaultApiBaseUrl,
  hasConfiguredBackend
} from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useOfflineSync } from '../../context/OfflineSyncContext';
import { useLanguage } from '../../context/LanguageContext';
import { useCart } from '../../context/CartContext';
import OfflineSyncBar from '../../components/admin/OfflineSyncBar';
import ProductImageDropzone from '../../components/admin/ProductImageDropzone';
import {
  CategoryDoughnutChart,
  CategoryStockBarChart,
  ReportsTradeBarChart
} from '../../components/admin/AdminCharts';
const DocsAdminWorkspace = lazy(() => import('../../components/docs/DocsAdminWorkspace'));
const DocsProvider = lazy(() =>
  import('../../context/DocsContext').then((m) => ({ default: m.DocsProvider }))
);
import {
  ensureOfflineDbSeeded,
  offlineDb,
  type OfflineCategory,
  type OfflineOrder,
  type OfflineProduct,
  type OfflineShipment,
  type OfflineUser,
  type OfflineWarehouse
} from '../../lib/offlineDb';
import {
  mergeServerCategoriesToDexie,
  mergeServerOrdersToDexie,
  mergeServerProductsToDexie,
  mergeServerShipmentsToDexie,
  mergeServerUsersToDexie
} from '../../lib/syncService';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { calculateOrderBreakdown } from '../../utils/pricing';
import {
  buildInvoiceFromOrder,
  normalizeApiOrderToOrderItem
} from '../../utils/invoiceGenerator';
import {
  downloadInvoicePdf,
  downloadOrderSummaryPdf,
  downloadAdminOrdersReportPdf
} from '../../utils/pdfExport';
import coldchainShowcaseImg from '../../assets/images/agrihub_coldchain_showcase_1794487417226.jpg';
import {
  ProductItem,
  OrderItem,
  LogisticsShipment,
  CategoryItem,
  UserItem,
  AuditLogItem,
  WarehouseItem,
  INITIAL_AUDIT_LOGS,
  INITIAL_WAREHOUSES
} from '../../mockData';

type ActiveView =
  | 'dashboard'
  | 'batches'
  | 'categories'
  | 'orders'
  | 'logistics'
  | 'warehouses'
  | 'users'
  | 'farmers'
  | 'buyers'
  | 'reports'
  | 'docs'
  | 'settings'
  | 'audit';
type RoleFilter = 'all' | 'admin' | 'farmer' | 'supplier' | 'buyer';

function viewFromPathname(pathname: string): ActiveView {
  const clean = pathname.replace(/\/+$/, '');
  if (clean.endsWith('/admin/orders')) return 'orders';
  if (clean.endsWith('/admin/logistics')) return 'logistics';
  if (clean.endsWith('/admin/warehouses')) return 'warehouses';
  if (clean.endsWith('/admin/products') || clean.endsWith('/admin/batches')) return 'batches';
  if (clean.endsWith('/admin/categories')) return 'categories';
  if (clean.endsWith('/admin/users')) return 'users';
  if (clean.endsWith('/admin/farmers')) return 'farmers';
  if (clean.endsWith('/admin/buyers')) return 'buyers';
  if (clean.endsWith('/admin/reports')) return 'reports';
  if (clean.endsWith('/admin/docs')) return 'docs';
  if (clean.endsWith('/admin/settings')) return 'settings';
  if (clean.endsWith('/admin/activity') || clean.endsWith('/admin/audit')) return 'audit';
  return 'dashboard';
}

function pathForView(view: ActiveView): string {
  if (view === 'batches') return '/admin/products';
  if (view === 'audit') return '/admin/activity';
  return `/admin/${view}`;
}

const CATEGORY_COLORS = ['#15803d', '#0284c7', '#eab308', '#06b6d4', '#f97316', '#8b5cf6'];

function formatAuditTarget(log: AuditLogRecord): string {
  const d = log.details || {};
  if (d.order_number) return String(d.order_number);
  if (d.batch_number) return String(d.batch_number);
  if (d.tracking_code) return String(d.tracking_code);
  if (d.target_user_id) return `User #${d.target_user_id}`;
  if (d.role) return `Role: ${d.role}`;
  if (log.user?.email) return log.user.email;
  return 'Platform';
}

function mapAuditLogRecord(log: AuditLogRecord): AuditLogItem {
  return {
    id: Number(log.id),
    action: log.action,
    actor: log.user?.name || 'System',
    role: log.user?.role || 'system',
    ip_address: log.ip_address || '—',
    target: formatAuditTarget(log),
    created_at: log.created_at,
    details: log.details || {}
  };
}

function buildLocalAdminStats(params: {
  users: UserItem[];
  products: ProductItem[];
  categories: CategoryItem[];
  orders: OrderItem[];
  shipments: LogisticsShipment[];
}): AdminStatsData {
  const byRole: Record<string, number> = { admin: 0, farmer: 0, supplier: 0, buyer: 0 };
  let verifiedTotal = 0;
  let farmersTotal = 0;
  let verifiedFarmers = 0;
  for (const u of params.users) {
    byRole[u.role] = (byRole[u.role] || 0) + 1;
    if (u.is_verified) verifiedTotal++;
    if (u.role === 'farmer') {
      farmersTotal++;
      if (u.is_verified) verifiedFarmers++;
    }
  }

  const activeProducts = params.products.filter((p) => p.status !== 'archived');
  const totalStockUnits = activeProducts.reduce((sum, p) => sum + Number(p.quantityAvailable || 0), 0);
  const totalInventoryValue = activeProducts.reduce(
    (sum, p) => sum + Number(p.quantityAvailable || 0) * Number(p.unitPrice || 0),
    0
  );
  const lowStockCount = activeProducts.filter(
    (p) => p.status === 'low_stock' || p.status === 'out_of_stock' || Number(p.quantityAvailable || 0) <= 100
  ).length;

  const nonCancelledOrders = params.orders.filter((o) => o.orderStatus !== 'cancelled');
  const totalGmv = nonCancelledOrders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const paidRevenue = nonCancelledOrders
    .filter((o) => o.paymentStatus === 'paid')
    .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const escrowRevenue = nonCancelledOrders
    .filter((o) => o.paymentStatus === 'escrow_held')
    .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const pendingOrders = params.orders.filter(
    (o) => o.orderStatus === 'placed' || o.orderStatus === 'confirmed' || o.orderStatus === 'processing'
  ).length;

  const activeShipments = params.shipments.filter(
    (s) => s.status === 'assigned' || s.status === 'in_transit' || s.status === 'delayed'
  ).length;
  const deliveredShipments = params.shipments.filter((s) => s.status === 'delivered').length;
  const delayedShipments = params.shipments.filter((s) => s.status === 'delayed').length;

  const categoryStats = params.categories.map((c) => {
    const matching = activeProducts.filter(
      (p) => Number(p.category_id) === Number(c.id) || p.category.toLowerCase() === c.name.toLowerCase()
    );
    return {
      id: c.id,
      name: c.name,
      product_count: matching.length || Number(c.skuCount || 0),
      total_stock_units: matching.reduce((sum, p) => sum + Number(p.quantityAvailable || 0), 0)
    };
  });

  return {
    users: {
      total: params.users.length,
      verified_total: verifiedTotal,
      by_role: byRole,
      verified_farmers: verifiedFarmers,
      farmer_kyc_pct: farmersTotal > 0 ? Math.round((verifiedFarmers / farmersTotal) * 100) : 100
    },
    products: {
      total_active: activeProducts.length,
      total_stock_units: totalStockUnits,
      total_inventory_value: totalInventoryValue,
      low_stock_count: lowStockCount
    },
    orders: {
      total_count: params.orders.length,
      pending_orders: pendingOrders,
      total_gmv: totalGmv,
      total_revenue: totalGmv,
      paid_revenue: paidRevenue,
      escrow_revenue: escrowRevenue
    },
    logistics: {
      active_shipments: activeShipments,
      delivered_shipments: deliveredShipments,
      delayed_shipments: delayedShipments,
      total_shipments: params.shipments.length
    },
    categories: categoryStats
  };
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentUser: authUser,
    login: authLogin,
    logout: authLogout,
    checkConnection: refreshAuth,
    updateCurrentUserProfile,
    apiUrl,
    setApiUrl
  } = useAuth();
  const {
    isBackendReachable,
    lastSyncedAt,
    saveProductOfflineFirst,
    deleteProductOfflineFirst,
    saveCategoryOfflineFirst,
    deleteCategoryOfflineFirst,
    saveUserOfflineFirst,
    deleteUserOfflineFirst,
    saveOrderStatusOfflineFirst,
    saveShipmentOfflineFirst,
    saveWarehouseOfflineFirst,
    deleteWarehouseOfflineFirst
  } = useOfflineSync();
  const { language, setLanguage, toggleLanguage, tr } = useLanguage();
  const { localOrders, openInvoice, recordOrder, updateLocalOrderStatus } = useCart();

  // Navigation & Shell State (synced with URL)
  const [activeView, setActiveView] = useState<ActiveView>(() => viewFromPathname(location.pathname));
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const globalSearchInputRef = React.useRef<HTMLInputElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState<boolean>(false);
  const [readAlertIds, setReadAlertIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('agrihub_read_alerts');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);
  const [profFullName, setProfFullName] = useState<string>('');
  const [profEmail, setProfEmail] = useState<string>('');
  const [profPhone, setProfPhone] = useState<string>('');
  const [profBusiness, setProfBusiness] = useState<string>('');
  const [profAddress, setProfAddress] = useState<string>('');
  const [profSaving, setProfSaving] = useState<boolean>(false);

  useEffect(() => {
    setActiveView(viewFromPathname(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        globalSearchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const goToView = (view: ActiveView) => {
    setActiveView(view);
    setMobileMenuOpen(false);
    navigate(pathForView(view));
  };

  // Connection & Loading State
  const [backendConnected, setBackendConnected] = useState<boolean | null>(null);
  const [backendMessage, setBackendMessage] = useState<string>('Loading platform metrics...');
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // User & Authentication State (strictly sourced from PHP session via AuthContext)
  const [currentUser, setCurrentUser] = useState<any>(authUser);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState<string>('admin@agrihub.com');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');

  // Real MySQL Dashboard & Domain Entity State
  const [adminStats, setAdminStats] = useState<AdminStatsData | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditLogItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [shipments, setShipments] = useState<LogisticsShipment[]>([]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Category & Product Error States
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);

  // Slide-Over Drawer: Create / Edit Harvest Batch (Product)
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategoryId, setNewCategoryId] = useState<number>(1);
  const [newFarmerId, setNewFarmerId] = useState<number>(0);
  const [newBatchCode, setNewBatchCode] = useState<string>('');
  const [newHarvestDate, setNewHarvestDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newExpiryDate, setNewExpiryDate] = useState<string>('');
  const [newQty, setNewQty] = useState<string>('1000');
  const [newUnitType, setNewUnitType] = useState<string>('kg');
  const [newPrice, setNewPrice] = useState<string>('150');
  const [newTemp, setNewTemp] = useState<string>('4.5');
  const [newStatus, setNewStatus] = useState<ProductItem['status']>('active');
  const [newOrganic, setNewOrganic] = useState<boolean>(true);
  const [newImageUrl, setNewImageUrl] = useState<string>('');
  const [drawerSubmitting, setDrawerSubmitting] = useState<boolean>(false);
  const [formFeedback, setFormFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Product Delete Dialog State
  const [deleteProductTarget, setDeleteProductTarget] = useState<ProductItem | null>(null);
  const [deleteProductLoading, setDeleteProductLoading] = useState<boolean>(false);
  const [deleteProductError, setDeleteProductError] = useState<string | null>(null);
  const [deleteProductHasOrders, setDeleteProductHasOrders] = useState<boolean>(false);

  // Category Filters & CRUD Modals
  const [categorySearch, setCategorySearch] = useState<string>('');
  const [categoryUsageFilter, setCategoryUsageFilter] = useState<'all' | 'with_products' | 'empty'>('all');
  const [categoryModalOpen, setCategoryModalOpen] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<CategoryItem | null>(null);
  const [catName, setCatName] = useState<string>('');
  const [catSlug, setCatSlug] = useState<string>('');
  const [catSlugTouched, setCatSlugTouched] = useState<boolean>(false);
  const [catDescription, setCatDescription] = useState<string>('');
  const [catSubmitting, setCatSubmitting] = useState<boolean>(false);
  const [catFormError, setCatFormError] = useState<string | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<CategoryItem | null>(null);
  const [deleteCategoryLoading, setDeleteCategoryLoading] = useState<boolean>(false);
  const [deleteCategoryError, setDeleteCategoryError] = useState<string | null>(null);

  // Product Filters
  const [productSearch, setProductSearch] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [organicOnly, setOrganicOnly] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Order Filters & Mutation State
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [orderUpdatingId, setOrderUpdatingId] = useState<number | null>(null);

  // Assign Shipment Modal State
  const [shipmentModalOrder, setShipmentModalOrder] = useState<OrderItem | null>(null);
  const [shipOriginHub, setShipOriginHub] = useState<string>('Rajshahi Collection Hub');
  const [shipDestHub, setShipDestHub] = useState<string>('Dhaka Central Cold Hub');
  const [shipVehicleNo, setShipVehicleNo] = useState<string>('REEFER-BD-4409');
  const [shipDriverName, setShipDriverName] = useState<string>('Rafiqul Islam');
  const [shipDriverPhone, setShipDriverPhone] = useState<string>('+880 1712-394850');
  const [shipTemp, setShipTemp] = useState<string>('4.2');
  const [shipSupplierId, setShipSupplierId] = useState<number>(0);
  const [shipSubmitting, setShipSubmitting] = useState<boolean>(false);

  // User Directory Filters & CRUD State
  const [userRoleFilter, setUserRoleFilter] = useState<RoleFilter>('all');
  const [userSearch, setUserSearch] = useState<string>('');
  const [userModalOpen, setUserModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [uFullName, setUFullName] = useState<string>('');
  const [uEmail, setUEmail] = useState<string>('');
  const [uPassword, setUPassword] = useState<string>('Password123!');
  const [uRole, setURole] = useState<'admin' | 'farmer' | 'supplier' | 'buyer'>('farmer');
  const [uPhone, setUPhone] = useState<string>('');
  const [uBusinessName, setUBusinessName] = useState<string>('');
  const [uTaxNid, setUTaxNid] = useState<string>('');
  const [uAddress, setUAddress] = useState<string>('');
  const [uVerified, setUVerified] = useState<boolean>(true);
  const [uSubmitting, setUSubmitting] = useState<boolean>(false);
  const [uFormError, setUFormError] = useState<string | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserItem | null>(null);
  const [deleteUserLoading, setDeleteUserLoading] = useState<boolean>(false);

  // Warehouses CRUD State (persisted locally for regional hubs)
  const [warehouses, setWarehouses] = useState<WarehouseItem[]>(() => {
    try {
      const saved = localStorage.getItem('agrihub_warehouses');
      if (saved) return JSON.parse(saved);
    } catch {}
    return INITIAL_WAREHOUSES;
  });
  const [warehouseSearch, setWarehouseSearch] = useState<string>('');
  const [warehouseModalOpen, setWarehouseModalOpen] = useState<boolean>(false);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseItem | null>(null);
  const [whCode, setWhCode] = useState<string>('');
  const [whName, setWhName] = useState<string>('');
  const [whRegion, setWhRegion] = useState<string>('Dhaka');
  const [whAddress, setWhAddress] = useState<string>('');
  const [whCapacity, setWhCapacity] = useState<string>('1000');
  const [whOccupied, setWhOccupied] = useState<string>('450');
  const [whTempRange, setWhTempRange] = useState<string>('2°C - 6°C');
  const [whManager, setWhManager] = useState<string>('');
  const [whStatus, setWhStatus] = useState<WarehouseItem['status']>('operational');

  // Platform Settings State
  const [tempAlertThreshold, setTempAlertThreshold] = useState<string>(() => {
    return localStorage.getItem('agrihub_temp_threshold') || '7.5';
  });
  const [apiEndpointOverride, setApiEndpointOverride] = useState<string>(() => {
    return apiUrl || getApiBaseUrl();
  });

  useEffect(() => {
    setApiEndpointOverride(apiUrl || getApiBaseUrl());
  }, [apiUrl]);

  // Selected Inspect Item Modals
  const [inspectProduct, setInspectProduct] = useState<ProductItem | null>(null);
  const [inspectAuditLog, setInspectAuditLog] = useState<AuditLogItem | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<LogisticsShipment | null>(null);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Toast Notice
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    setCurrentUser(authUser);
  }, [authUser]);

  const loadFromIndexedDb = async (preserveExistingStats = false) => {
    await ensureOfflineDbSeeded();
    const [dbProds, dbCats, dbUsers, dbOrders, dbShips, dbWarehouses, dbLogs] = await Promise.all([
      offlineDb.products.toArray(),
      offlineDb.categories.toArray(),
      offlineDb.users.toArray(),
      offlineDb.orders.toArray(),
      offlineDb.shipments.toArray(),
      offlineDb.warehouses.toArray(),
      offlineDb.syncLogs.orderBy('id').reverse().limit(30).toArray()
    ]);

    const sortedProds = [...dbProds].sort((a, b) => Number(b.id) - Number(a.id));
    const enrichedCats = dbCats.map((c) => {
      const count = sortedProds.filter(
        (p) =>
          p.status !== 'archived' &&
          (Number(p.category_id) === Number(c.id) ||
            p.category.toLowerCase() === c.name.toLowerCase())
      ).length;
      return { ...c, skuCount: count > 0 ? count : c.skuCount };
    });

    const seenOrderNums = new Set(dbOrders.map((o) => o.orderNumber));
    const seenOrderIds = new Set(dbOrders.map((o) => Number(o.id)));
    const combinedOrders: OrderItem[] = [...dbOrders];
    for (const lo of localOrders) {
      if (!seenOrderNums.has(lo.orderNumber) && !seenOrderIds.has(Number(lo.id))) {
        combinedOrders.push(lo);
      }
    }

    setProducts(sortedProds);
    setCategories(enrichedCats);
    setUsers(dbUsers);
    setOrders(combinedOrders);
    setShipments(dbShips);
    setSelectedShipment((prev) =>
      prev ? dbShips.find((s) => s.id === prev.id) || dbShips[0] || null : dbShips[0] || null
    );
    if (dbWarehouses.length > 0) {
      setWarehouses(dbWarehouses);
    }

    if (!preserveExistingStats) {
      setAdminStats(
        buildLocalAdminStats({
          users: dbUsers,
          products: sortedProds,
          categories: enrichedCats,
          orders: combinedOrders,
          shipments: dbShips
        })
      );
      const mappedSyncLogs: AuditLogItem[] = dbLogs.map((l, idx) => ({
        id: 100000 + Number(l.id ?? idx + 1),
        action: l.action,
        actor: 'Offline Sync Engine',
        role: 'system',
        ip_address: 'Local',
        target: `${l.entityType}${l.entityId ? ` #${l.entityId}` : ''}`,
        created_at: l.timestamp.replace('T', ' ').slice(0, 19),
        details: { level: l.level, message: l.message }
      }));
      const mergedAudit = [...mappedSyncLogs, ...INITIAL_AUDIT_LOGS];
      setAuditLogs(mergedAudit);
      setRecentActivity(mergedAudit.slice(0, 8));
    }

    return { sortedProds, enrichedCats, dbUsers, combinedOrders, dbShips };
  };

  // 1. Initial Connection & IndexedDB Hydration + Real Platform API Sync
  useEffect(() => {
    checkConnectionAndLoad();
  }, []);

  // Re-hydrate from IndexedDB whenever background sync updates server IDs or finishes syncing
  useEffect(() => {
    if (lastSyncedAt) {
      loadFromIndexedDb(true);
    }
  }, [lastSyncedAt]);

  useEffect(() => {
    setOrders(prev => {
      if (prev.length === 0) return localOrders;
      const seenNums = new Set(prev.map(o => o.orderNumber));
      const seenIds = new Set(prev.map(o => Number(o.id)));
      const additions = localOrders.filter(
        lo => !seenNums.has(lo.orderNumber) && !seenIds.has(Number(lo.id))
      );
      return additions.length > 0 ? [...additions, ...prev] : prev;
    });
  }, [localOrders]);

  const checkConnectionAndLoad = async () => {
    setLoadingData(true);
    setDashboardError(null);
    setCategoriesError(null);
    setProductsError(null);

    try {
      // Always hydrate immediately from Dexie IndexedDB so UI never blanks offline
      await loadFromIndexedDb(false);

      if (!hasConfiguredBackend()) {
        setBackendConnected(false);
        setBackendMessage('Local workspace active');
        return;
      }

      const [statsRes, logsRes, prodsRes, catsRes, ordsRes, shipsRes, usersRes] = await Promise.allSettled([
        AgriHubApi.getAdminStats(),
        AgriHubApi.getAuditLogs(50),
        AgriHubApi.getAdminProducts(),
        AgriHubApi.getAdminCategories(),
        AgriHubApi.getOrders(),
        AgriHubApi.getShipments(),
        AgriHubApi.getUsers()
      ]);

      let statsPayload: AdminStatsData | null = null;
      let anyLiveSuccess = false;

      if (statsRes.status === 'fulfilled' && statsRes.value.success && statsRes.value.data) {
        anyLiveSuccess = true;
        statsPayload = statsRes.value.data;
        setAdminStats(statsPayload);
        setBackendConnected(true);
        setBackendMessage('Live sync active');

        if (Array.isArray(statsPayload.recent_activity)) {
          setRecentActivity(statsPayload.recent_activity.map(mapAuditLogRecord));
        }
      } else {
        const err = statsRes.status === 'rejected' ? statsRes.reason : null;
        if (err?.status === 401) {
          setBackendConnected(true);
          setBackendMessage('Session expired. Operating with saved local data.');
          await refreshAuth();
        } else {
          setBackendConnected(false);
          setBackendMessage(err?.message || 'Operating in local mode');
        }
      }

      if (logsRes.status === 'fulfilled' && logsRes.value.success && Array.isArray(logsRes.value.data)) {
        anyLiveSuccess = true;
        const mappedLogs = logsRes.value.data.map(mapAuditLogRecord);
        setAuditLogs(mappedLogs);
        if (!statsPayload?.recent_activity) {
          setRecentActivity(mappedLogs.slice(0, 8));
        }
      }

      const nowIso = new Date().toISOString();

      if (prodsRes.status === 'fulfilled' && prodsRes.value.success && Array.isArray(prodsRes.value.data)) {
        anyLiveSuccess = true;
        const mappedProducts: OfflineProduct[] = prodsRes.value.data.map((p: any) => ({
          id: Number(p.id),
          farmer_id: Number(p.farmer_id),
          farmerName: p.farmer?.business_name
            ? `${p.farmer.name || p.farmer_name} (${p.farmer.business_name})`
            : p.farmer?.name || p.farmer_name || 'Registered Producer',
          farmLocation: p.farmer?.location || 'Verified Farm Origin',
          category: p.category?.name || p.category_name || 'Uncategorized',
          category_id: Number(p.category_id),
          title: p.title || '',
          batchNumber: p.batch_number || '',
          harvestDate: p.harvest_date || '',
          expiryDate: p.expiry_date || '',
          unitPrice: Number(p.unit_price || 0),
          unitType: p.unit_type || 'kg',
          quantityAvailable: Number(p.quantity_available || 0),
          storageTempCelsius:
            p.storage_temp_celsius !== null && p.storage_temp_celsius !== undefined
              ? Number(p.storage_temp_celsius)
              : 0,
          isOrganic: Boolean(p.is_organic),
          status: p.status || 'active',
          syncStatus: 'synced',
          localUpdatedAt: nowIso,
          serverUpdatedAt: p.updated_at || p.created_at || nowIso
        }));
        await mergeServerProductsToDexie(mappedProducts);
      }

      if (catsRes.status === 'fulfilled' && catsRes.value.success && Array.isArray(catsRes.value.data)) {
        anyLiveSuccess = true;
        const mappedCategories: OfflineCategory[] = catsRes.value.data.map((c: any, i: number) => ({
          id: Number(c.id),
          name: c.name,
          slug: c.slug,
          description: c.description || '',
          skuCount: Number(c.product_count ?? 0),
          tempRange: c.created_at ? String(c.created_at).slice(0, 10) : '—',
          iconName: i === 0 ? 'Apple' : i === 1 ? 'Wheat' : i === 2 ? 'Milk' : i === 3 ? 'Droplets' : 'Carrot',
          syncStatus: 'synced',
          localUpdatedAt: nowIso,
          serverUpdatedAt: c.created_at || nowIso
        }));
        await mergeServerCategoriesToDexie(mappedCategories);
      }

      if (ordsRes.status === 'fulfilled' && ordsRes.value.success && Array.isArray(ordsRes.value.data)) {
        anyLiveSuccess = true;
        const normalizedApi: OfflineOrder[] = ordsRes.value.data.map((raw: any) => ({
          ...normalizeApiOrderToOrderItem(raw),
          syncStatus: 'synced',
          localUpdatedAt: nowIso,
          serverUpdatedAt: raw.updated_at || raw.created_at || nowIso
        }));
        await mergeServerOrdersToDexie(normalizedApi);
      }

      if (shipsRes.status === 'fulfilled' && shipsRes.value.success && Array.isArray(shipsRes.value.data)) {
        anyLiveSuccess = true;
        const mappedShipments: OfflineShipment[] = shipsRes.value.data.map((s: any) => ({
          id: Number(s.id),
          trackingCode: s.tracking_code,
          orderNumber: s.order_number || `Order #${s.order_id}`,
          product: `Order ${s.order_number || '#' + s.order_id}`,
          supplierName: s.supplier?.business_name || s.supplier?.name || 'Carrier',
          vehicleNumber: s.vehicle_number || 'Unassigned',
          driverName: s.driver_name || 'Unassigned',
          driverPhone: s.driver_phone || '',
          currentTempCelsius:
            s.temperature_celsius !== null && s.temperature_celsius !== undefined
              ? Number(s.temperature_celsius)
              : 0,
          targetTempCelsius: 5.0,
          originHub: s.origin_hub || '',
          destinationHub: s.destination_hub || '',
          status: s.status || 'assigned',
          eta: s.estimated_delivery || 'Pending ETA',
          checkpoints: [
            ...(s.dispatched_at
              ? [{ time: s.dispatched_at, location: s.origin_hub || 'Origin Hub', note: 'Shipment dispatched' }]
              : []),
            ...(s.delivered_at
              ? [{ time: s.delivered_at, location: s.destination_hub || 'Destination Hub', note: 'Shipment delivered' }]
              : [])
          ],
          syncStatus: 'synced',
          localUpdatedAt: nowIso,
          serverUpdatedAt: s.updated_at || nowIso
        }));
        await mergeServerShipmentsToDexie(mappedShipments);
      }

      if (usersRes.status === 'fulfilled' && usersRes.value.success && Array.isArray(usersRes.value.data)) {
        anyLiveSuccess = true;
        const mappedUsers: OfflineUser[] = usersRes.value.data.map((u: any) => ({
          ...u,
          syncStatus: 'synced',
          localUpdatedAt: nowIso,
          serverUpdatedAt: u.created_at || nowIso
        }));
        await mergeServerUsersToDexie(mappedUsers);
      }

      if (anyLiveSuccess) {
        // Reload UI cleanly from Dexie so any pending offline edits stay preserved alongside server data
        await loadFromIndexedDb(Boolean(statsPayload));
      }
    } catch (err: any) {
      setBackendConnected(false);
      setBackendMessage(err?.message || 'Local workspace active');
    } finally {
      setLoadingData(false);
    }
  };

  // Sign In Handler (uses AuthContext for live PHP auth or Offline-First fallback)
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');

    try {
      const user = await authLogin(loginEmail.trim(), loginPassword);
      if (user) {
        setCurrentUser(user);
        setShowLoginModal(false);
        showToast(`Welcome back, ${user.full_name}`);
        await checkConnectionAndLoad();
      } else {
        setLoginError('Invalid administrator credentials.');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await authLogout();
    setCurrentUser(null);
    showToast('Signed out of session', 'info');
    navigate('/login');
  };

  // Category CRUD Handlers
  const slugifyCategory = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const openCreateCategoryModal = () => {
    setEditingCategory(null);
    setCatName('');
    setCatSlug('');
    setCatSlugTouched(false);
    setCatDescription('');
    setCatFormError(null);
    setCategoryModalOpen(true);
  };

  const openEditCategoryModal = (cat: CategoryItem) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatSlug(cat.slug);
    setCatSlugTouched(true);
    setCatDescription(cat.description || '');
    setCatFormError(null);
    setCategoryModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = catName.trim();
    const trimmedSlug = slugifyCategory(catSlug || trimmedName);

    if (trimmedName.length < 2) {
      setCatFormError('Category name must be at least 2 characters.');
      return;
    }
    if (!trimmedSlug) {
      setCatFormError('A valid slug is required.');
      return;
    }

    setCatSubmitting(true);
    setCatFormError(null);
    try {
      const apiPayload = {
        id: editingCategory?.id,
        name: trimmedName,
        slug: trimmedSlug,
        description: catDescription.trim()
      };
      const existingOffline = editingCategory
        ? await offlineDb.categories.get(editingCategory.id)
        : undefined;
      await saveCategoryOfflineFirst(
        {
          id: editingCategory?.id,
          name: trimmedName,
          slug: trimmedSlug,
          description: catDescription.trim(),
          skuCount: editingCategory?.skuCount ?? 0,
          tempRange: editingCategory?.tempRange ?? '2°C - 12°C',
          iconName: editingCategory?.iconName ?? 'Leaf',
          serverUpdatedAt: existingOffline?.serverUpdatedAt
        },
        editingCategory ? 'update' : 'create',
        apiPayload
      );
      showToast(
        isBackendReachable
          ? `Category '${trimmedName}' saved and synced.`
          : `Category '${trimmedName}' saved locally (queued for sync).`
      );
      setCategoryModalOpen(false);
      await loadFromIndexedDb(false);
    } catch (err: any) {
      setCatFormError(err?.message || 'Failed to save category.');
    } finally {
      setCatSubmitting(false);
    }
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deleteCategoryTarget) return;
    setDeleteCategoryLoading(true);
    setDeleteCategoryError(null);
    try {
      const existingOffline = await offlineDb.categories.get(deleteCategoryTarget.id);
      await deleteCategoryOfflineFirst(
        existingOffline || {
          ...deleteCategoryTarget,
          syncStatus: 'synced',
          localUpdatedAt: new Date().toISOString()
        }
      );
      showToast(
        isBackendReachable
          ? `Category '${deleteCategoryTarget.name}' deleted.`
          : `Category '${deleteCategoryTarget.name}' removed locally (delete queued for sync).`,
        'info'
      );
      setDeleteCategoryTarget(null);
      await loadFromIndexedDb(false);
    } catch (err: any) {
      setDeleteCategoryError(err?.message || 'Failed to delete category.');
    } finally {
      setDeleteCategoryLoading(false);
    }
  };

  // Product Create / Edit Drawer Handlers
  const openCreateProductDrawer = () => {
    const defaultFarmer = users.find(u => u.role === 'farmer')?.id || currentUser?.id || 0;
    const defaultCat = categories[0]?.id || 0;
    setEditingProduct(null);
    setNewTitle('');
    setNewCategoryId(defaultCat);
    setNewFarmerId(defaultFarmer);
    setNewBatchCode(`BATCH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
    setNewHarvestDate(new Date().toISOString().split('T')[0]);
    setNewExpiryDate('');
    setNewQty('1000');
    setNewUnitType('kg');
    setNewPrice('150');
    setNewTemp('4.5');
    setNewStatus('active');
    setNewOrganic(true);
    setNewImageUrl('');
    setFormFeedback(null);
    setDrawerOpen(true);
  };

  const openEditProductDrawer = (p: ProductItem) => {
    setEditingProduct(p);
    setNewTitle(p.title);
    setNewCategoryId(p.category_id || categories.find(c => c.name === p.category)?.id || categories[0]?.id || 0);
    setNewFarmerId(p.farmer_id || users.find(u => u.role === 'farmer')?.id || currentUser?.id || 0);
    setNewBatchCode(p.batchNumber);
    setNewHarvestDate(p.harvestDate || '');
    setNewExpiryDate(p.expiryDate || '');
    setNewQty(String(p.quantityAvailable));
    setNewUnitType(p.unitType);
    setNewPrice(String(p.unitPrice));
    setNewTemp(p.storageTempCelsius !== null && p.storageTempCelsius !== undefined ? String(p.storageTempCelsius) : '');
    setNewStatus(p.status);
    setNewOrganic(Boolean(p.isOrganic));
    setNewImageUrl(p.imageUrl || '');
    setFormFeedback(null);
    setDrawerOpen(true);
  };

  // Create or Update Produce Batch (Offline-First via Dexie + Auto-Sync)
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setFormFeedback({ type: 'error', message: 'Produce title is required.' });
      return;
    }
    if (!newCategoryId) {
      setFormFeedback({ type: 'error', message: 'Please select a valid category.' });
      return;
    }

    setDrawerSubmitting(true);
    setFormFeedback(null);

    const parsedPrice = parseFloat(newPrice);
    const parsedQty = parseFloat(newQty);
    const parsedTemp = newTemp.trim() === '' ? null : parseFloat(newTemp);

    const payload = {
      id: editingProduct?.id,
      title: newTitle.trim(),
      category_id: newCategoryId,
      farmer_id: newFarmerId || undefined,
      batch_number: newBatchCode.trim() || undefined,
      harvest_date: newHarvestDate || null,
      expiry_date: newExpiryDate || null,
      unit_price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
      unit_type: newUnitType,
      quantity_available: Number.isFinite(parsedQty) ? parsedQty : 0,
      storage_temp_celsius: parsedTemp !== null && Number.isFinite(parsedTemp) ? parsedTemp : null,
      is_organic: newOrganic,
      status: newStatus,
      image_url: newImageUrl.trim() || undefined
    };

    try {
      const selectedCat = categories.find((c) => Number(c.id) === Number(newCategoryId));
      const selectedFarmer = users.find((u) => Number(u.id) === Number(newFarmerId));
      const existingOffline = editingProduct
        ? await offlineDb.products.get(editingProduct.id)
        : undefined;

      await saveProductOfflineFirst(
        {
          id: editingProduct?.id,
          farmer_id: Number(newFarmerId || editingProduct?.farmer_id || 2),
          farmerName: selectedFarmer
            ? selectedFarmer.business_name
              ? `${selectedFarmer.full_name} (${selectedFarmer.business_name})`
              : selectedFarmer.full_name
            : editingProduct?.farmerName || 'Registered Producer',
          farmLocation: selectedFarmer?.address || editingProduct?.farmLocation || 'Verified Farm Origin',
          category: selectedCat?.name || editingProduct?.category || 'Fresh Produce',
          category_id: Number(newCategoryId),
          title: payload.title,
          batchNumber:
            payload.batch_number ||
            editingProduct?.batchNumber ||
            `BATCH-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
          harvestDate: newHarvestDate || new Date().toISOString().split('T')[0],
          expiryDate: newExpiryDate || '',
          unitPrice: payload.unit_price,
          unitType: payload.unit_type,
          quantityAvailable: payload.quantity_available,
          storageTempCelsius: payload.storage_temp_celsius ?? 4.5,
          isOrganic: Boolean(payload.is_organic),
          status: payload.status as ProductItem['status'],
          imageUrl: newImageUrl.trim() || undefined,
          serverUpdatedAt: existingOffline?.serverUpdatedAt
        },
        editingProduct ? 'update' : 'create',
        payload
      );

      showToast(
        isBackendReachable
          ? `Product '${payload.title}' saved and synced.`
          : `Product '${payload.title}' saved locally — queued for sync.`
      );
      setDrawerOpen(false);
      setEditingProduct(null);
      await loadFromIndexedDb(false);
    } catch (err: any) {
      setFormFeedback({ type: 'error', message: err.message || 'Failed to save product.' });
    } finally {
      setDrawerSubmitting(false);
    }
  };

  const openDeleteProductDialog = (p: ProductItem) => {
    setDeleteProductTarget(p);
    setDeleteProductError(null);
    setDeleteProductHasOrders(false);
  };

  const handleConfirmDeleteProduct = async () => {
    if (!deleteProductTarget) return;
    setDeleteProductLoading(true);
    setDeleteProductError(null);
    try {
      const existingOffline = await offlineDb.products.get(deleteProductTarget.id);
      await deleteProductOfflineFirst(
        existingOffline || {
          ...deleteProductTarget,
          syncStatus: 'synced',
          localUpdatedAt: new Date().toISOString()
        }
      );
      showToast(
        isBackendReachable
          ? `Product '${deleteProductTarget.batchNumber}' deleted.`
          : `Product '${deleteProductTarget.batchNumber}' deleted locally (queued for sync).`,
        'info'
      );
      setDeleteProductTarget(null);
      await loadFromIndexedDb(false);
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete product.';
      setDeleteProductError(msg);
      if (err?.status === 409) {
        setDeleteProductHasOrders(true);
      }
    } finally {
      setDeleteProductLoading(false);
    }
  };

  const handleArchiveInsteadOfDelete = async () => {
    if (!deleteProductTarget) return;
    setDeleteProductLoading(true);
    setDeleteProductError(null);
    try {
      const catId =
        deleteProductTarget.category_id ||
        categories.find(c => c.name === deleteProductTarget.category)?.id ||
        categories[0]?.id ||
        1;
      const apiPayload = {
        id: deleteProductTarget.id,
        title: deleteProductTarget.title,
        category_id: catId,
        farmer_id: deleteProductTarget.farmer_id,
        batch_number: deleteProductTarget.batchNumber,
        harvest_date: deleteProductTarget.harvestDate || null,
        expiry_date: deleteProductTarget.expiryDate || null,
        unit_price: deleteProductTarget.unitPrice,
        unit_type: deleteProductTarget.unitType,
        quantity_available: deleteProductTarget.quantityAvailable,
        storage_temp_celsius: deleteProductTarget.storageTempCelsius,
        is_organic: deleteProductTarget.isOrganic,
        status: 'archived'
      };
      const existingOffline = await offlineDb.products.get(deleteProductTarget.id);
      await saveProductOfflineFirst(
        {
          ...(existingOffline || deleteProductTarget),
          status: 'archived',
          serverUpdatedAt: existingOffline?.serverUpdatedAt
        },
        'update',
        apiPayload
      );
      showToast(`Batch '${deleteProductTarget.batchNumber}' archived locally & queued for sync.`);
      setDeleteProductTarget(null);
      await loadFromIndexedDb(false);
    } catch (err: any) {
      setDeleteProductError(err?.message || 'Failed to archive product.');
    } finally {
      setDeleteProductLoading(false);
    }
  };

  // Place Wholesale Order (With Standardized Breakdown & Stock Deduction)
  const handlePlaceWholesaleOrder = async (product: ProductItem, requestedQty: number = 250) => {
    try {
      const breakdown = calculateOrderBreakdown({
        items: [
          {
            productId: product.id,
            title: product.title,
            batchNumber: product.batchNumber,
            unitPrice: product.unitPrice,
            unitType: product.unitType,
            quantity: requestedQty
          }
        ],
        deliveryZone: 'dhaka'
      });

      if (backendConnected) {
        const res = await AgriHubApi.createOrder({
          items: [{ product_id: product.id, quantity: requestedQty }],
          delivery_address: 'FreshBasket Central Depot, Sector 4, Tejgaon, Dhaka',
          notes: 'Cold-chain handling required'
        });
        if (res.success) {
          showToast(`Order ${res.data.order_number} confirmed. Stock reserved.`);
          checkConnectionAndLoad();
        }
      } else {
        const updatedProds = products.map(p => {
          if (p.id === product.id) {
            const nextQty = Math.max(0, (p.quantityAvailable || 0) - requestedQty);
            return {
              ...p,
              quantityAvailable: nextQty,
              status: (nextQty <= 0 ? 'out_of_stock' : nextQty <= 100 ? 'low_stock' : 'active') as any
            };
          }
          return p;
        });
        setProducts(updatedProds);

        const orderNumber = `AGRI-ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;
        const newOrder: OrderItem = {
          id: Date.now(),
          invoiceNumber: `INV-${orderNumber.replace(/[^0-9A-Z]/gi, '').slice(-8)}`,
          orderNumber,
          buyerName: currentUser?.full_name || 'FreshBasket Supermarkets Ltd.',
          buyerEmail: currentUser?.email || 'procure@freshbasket.com',
          buyerPhone: currentUser?.phone || '+880 1711-000800',
          productTitle: product.title,
          batchNumber: product.batchNumber,
          unitPrice: product.unitPrice,
          quantity: requestedQty,
          unitType: product.unitType,
          items: breakdown.items.map(line => ({
            productId: line.productId,
            title: line.title,
            batchNumber: line.batchNumber,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            unitType: line.unitType,
            lineTotal: line.lineTotal
          })),
          subtotal: breakdown.subtotal,
          shippingFee: breakdown.shipping,
          discountAmount: breakdown.discount,
          taxAmount: breakdown.tax,
          totalAmount: breakdown.grandTotal,
          paymentMethod: 'bank_escrow',
          paymentStatus: 'escrow_held',
          orderStatus: 'placed',
          deliveryAddress: 'FreshBasket Central Depot, Sector 4, Tejgaon, Dhaka',
          notes: 'Cold-chain handling required',
          createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16)
        };
        recordOrder(newOrder);
        setOrders(prev => [newOrder, ...prev]);
        showToast(`Order ${newOrder.orderNumber} initiated (${formatCurrency(newOrder.totalAmount, language)}).`);
      }
    } catch (err: any) {
      showToast(err.message || 'Order creation failed', 'error');
    }
  };

  // Order Status Update Handler (Offline-First Dexie + Automatic Backend Sync)
  const handleUpdateOrderStatus = async (
    order: OrderItem,
    nextStatus: 'processing' | 'shipped' | 'delivered' | 'cancelled'
  ) => {
    setOrderUpdatingId(order.id);
    try {
      const existingOffline = await offlineDb.orders.get(order.id);
      const baseOrder: OfflineOrder = existingOffline || {
        ...order,
        syncStatus: 'synced',
        localUpdatedAt: new Date().toISOString()
      };
      await saveOrderStatusOfflineFirst(baseOrder, nextStatus);
      updateLocalOrderStatus(order.id, nextStatus);
      await loadFromIndexedDb(false);
      showToast(
        isBackendReachable
          ? `Order ${order.orderNumber} updated to ${nextStatus}.`
          : `Order ${order.orderNumber} updated offline (${nextStatus}) — queued for sync.`
      );
    } catch (err: any) {
      showToast(err?.message || 'Failed to update order status', 'error');
    } finally {
      setOrderUpdatingId(null);
    }
  };

  const handleDownloadOrderPdf = async (order: OrderItem, mode: 'invoice' | 'summary') => {
    try {
      const invoice = buildInvoiceFromOrder(order);
      if (mode === 'invoice') {
        await downloadInvoicePdf(invoice, language);
      } else {
        await downloadOrderSummaryPdf(invoice, language);
      }
      showToast(
        mode === 'invoice'
          ? tr(`Downloaded invoice PDF for ${order.orderNumber}`, `${order.orderNumber} ইনভয়েস PDF ডাউনলোড হয়েছে`)
          : tr(`Downloaded summary PDF for ${order.orderNumber}`, `${order.orderNumber} সারাংশ PDF ডাউনলোড হয়েছে`)
      );
    } catch (err: any) {
      showToast(err?.message || tr('Could not generate PDF.', 'পিডিএফ তৈরি করা যায়নি।'), 'error');
    }
  };

  const handleDownloadOrdersReportPdf = async () => {
    try {
      await downloadAdminOrdersReportPdf(orders, language);
      showToast(tr('Trade Orders Report PDF downloaded.', 'ট্রেড অর্ডার রিপোর্ট PDF ডাউনলোড হয়েছে।'));
    } catch (err: any) {
      showToast(err?.message || tr('Could not export Orders Report PDF.', 'অর্ডার রিপোর্ট PDF তৈরি করা যায়নি।'), 'error');
    }
  };

  // Assign Cold-Chain Shipment Handler
  const openAssignShipmentModal = (order: OrderItem) => {
    setShipmentModalOrder(order);
    setShipDestHub(order.deliveryAddress || 'Dhaka Central Cold Hub');
    const defaultSupplier = users.find(u => u.role === 'supplier')?.id || 0;
    setShipSupplierId(defaultSupplier);
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shipmentModalOrder) return;
    setShipSubmitting(true);
    try {
      const apiPayload = {
        order_id: shipmentModalOrder.id,
        supplier_id: shipSupplierId || undefined,
        origin_hub: shipOriginHub.trim(),
        destination_hub: shipDestHub.trim(),
        vehicle_number: shipVehicleNo.trim(),
        driver_name: shipDriverName.trim(),
        driver_phone: shipDriverPhone.trim(),
        temperature_celsius: Number(shipTemp) || 4.2
      };
      const supplierMatch = users.find((u) => Number(u.id) === Number(shipSupplierId));
      const created = await saveShipmentOfflineFirst(
        {
          trackingCode: `TRK-COLD-2026-${Math.floor(1000 + Math.random() * 9000)}`,
          orderNumber: shipmentModalOrder.orderNumber,
          product: shipmentModalOrder.productTitle,
          supplierName: supplierMatch?.business_name || supplierMatch?.full_name || 'AgroCold Logistics Fleet',
          vehicleNumber: shipVehicleNo.trim(),
          driverName: shipDriverName.trim(),
          driverPhone: shipDriverPhone.trim(),
          currentTempCelsius: Number(shipTemp) || 4.2,
          targetTempCelsius: 5.0,
          originHub: shipOriginHub.trim(),
          destinationHub: shipDestHub.trim(),
          status: 'assigned',
          eta: '6 hours',
          checkpoints: [{ time: 'Now', location: shipOriginHub.trim(), note: 'Cold-chain vehicle assigned' }]
        },
        'create',
        apiPayload
      );
      await loadFromIndexedDb(false);
      setSelectedShipment(created);
      showToast(
        isBackendReachable
          ? `Cold-chain shipment assigned to ${shipmentModalOrder.orderNumber}.`
          : `Shipment assigned offline for ${shipmentModalOrder.orderNumber} — queued for sync.`
      );
      setShipmentModalOrder(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to assign shipment', 'error');
    } finally {
      setShipSubmitting(false);
    }
  };

  // Update Shipment Status (Offline-First)
  const handleUpdateShipment = async (shipmentId: number, nextStatus: string) => {
    try {
      const existing = (await offlineDb.shipments.get(shipmentId)) || shipments.find((s) => s.id === shipmentId);
      if (!existing) return;
      const updatedRecord: Omit<OfflineShipment, 'syncStatus' | 'localUpdatedAt'> & { id?: number } = {
        ...existing,
        id: shipmentId,
        status: nextStatus as LogisticsShipment['status'],
        checkpoints: [
          ...existing.checkpoints,
          {
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            location: nextStatus === 'delivered' ? existing.destinationHub : 'Highway Checkpost',
            note: `Route milestone updated to ${nextStatus.toUpperCase()}`
          }
        ]
      };
      await saveShipmentOfflineFirst(updatedRecord, 'update', {
        shipment_id: shipmentId,
        status: nextStatus,
        temperature_celsius: existing.currentTempCelsius ?? 4.2
      });
      await loadFromIndexedDb(false);
      showToast(
        isBackendReachable
          ? `Shipment status updated to ${nextStatus.replace('_', ' ')}.`
          : `Shipment updated offline (${nextStatus.replace('_', ' ')}) — queued for sync.`
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to update shipment', 'error');
    }
  };

  // Toggle Member Verification (Offline-First)
  const handleToggleVerification = async (userId: number, currentStatus: boolean) => {
    try {
      const existing = (await offlineDb.users.get(userId)) || users.find((u) => u.id === userId);
      if (!existing) return;
      await saveUserOfflineFirst(
        {
          ...existing,
          id: userId,
          is_verified: !currentStatus
        },
        'update',
        {
          _verificationOnly: true,
          user_id: userId,
          is_verified: !currentStatus
        }
      );
      await loadFromIndexedDb(false);
      showToast(
        isBackendReachable
          ? `Member verification ${!currentStatus ? 'Approved' : 'Suspended'}.`
          : `Verification updated offline (${!currentStatus ? 'Approved' : 'Suspended'}) — queued for sync.`
      );
    } catch (err: any) {
      showToast(err.message || 'Verification update failed', 'error');
    }
  };

  // Member Create / Edit / Delete Handlers
  const openCreateUserModal = (defaultRole: 'admin' | 'farmer' | 'supplier' | 'buyer' = 'farmer') => {
    setEditingUser(null);
    setUFullName('');
    setUEmail('');
    setUPassword('Password123!');
    setURole(defaultRole);
    setUPhone('');
    setUBusinessName('');
    setUTaxNid('');
    setUAddress('');
    setUVerified(true);
    setUFormError(null);
    setUserModalOpen(true);
  };

  const openEditUserModal = (u: UserItem) => {
    setEditingUser(u);
    setUFullName(u.full_name);
    setUEmail(u.email);
    setUPassword('');
    setURole(u.role);
    setUPhone(u.phone || '');
    setUBusinessName(u.business_name || '');
    setUTaxNid(u.tax_or_nid_no || '');
    setUAddress(u.address || '');
    setUVerified(Boolean(u.is_verified));
    setUFormError(null);
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uFullName.trim()) {
      setUFormError('Full name is required.');
      return;
    }
    setUSubmitting(true);
    setUFormError(null);
    try {
      if (!editingUser && !uEmail.trim()) {
        setUFormError('Email address is required.');
        setUSubmitting(false);
        return;
      }

      const existingOffline = editingUser ? await offlineDb.users.get(editingUser.id) : undefined;
      const apiPayload = editingUser
        ? {
            id: editingUser.id,
            full_name: uFullName.trim(),
            role: uRole,
            phone: uPhone.trim(),
            business_name: uBusinessName.trim(),
            tax_or_nid_no: uTaxNid.trim(),
            address: uAddress.trim(),
            is_verified: uVerified
          }
        : {
            full_name: uFullName.trim(),
            email: uEmail.trim(),
            password: uPassword || 'Password123!',
            role: uRole,
            phone: uPhone.trim(),
            business_name: uBusinessName.trim(),
            tax_or_nid_no: uTaxNid.trim(),
            address: uAddress.trim(),
            is_verified: uVerified
          };

      await saveUserOfflineFirst(
        {
          id: editingUser?.id,
          role: uRole,
          full_name: uFullName.trim(),
          email: editingUser ? editingUser.email : uEmail.trim(),
          phone: uPhone.trim(),
          business_name: uBusinessName.trim(),
          tax_or_nid_no: uTaxNid.trim(),
          address: uAddress.trim(),
          is_verified: uVerified,
          created_at: editingUser?.created_at || new Date().toISOString().replace('T', ' ').slice(0, 19),
          serverUpdatedAt: existingOffline?.serverUpdatedAt
        },
        editingUser ? 'update' : 'create',
        apiPayload
      );
      showToast(
        isBackendReachable
          ? `Member '${uFullName.trim()}' saved and synced.`
          : `Member '${uFullName.trim()}' saved offline — queued for sync.`
      );
      setUserModalOpen(false);
      await loadFromIndexedDb(false);
    } catch (err: any) {
      setUFormError(err?.message || 'Failed to save member account.');
    } finally {
      setUSubmitting(false);
    }
  };

  const handleConfirmDeleteUser = async () => {
    if (!deleteUserTarget) return;
    setDeleteUserLoading(true);
    try {
      const existingOffline = await offlineDb.users.get(deleteUserTarget.id);
      await deleteUserOfflineFirst(
        existingOffline || {
          ...deleteUserTarget,
          syncStatus: 'synced',
          localUpdatedAt: new Date().toISOString()
        }
      );
      showToast(
        isBackendReachable
          ? `Member '${deleteUserTarget.full_name}' removed.`
          : `Member '${deleteUserTarget.full_name}' removed locally (queued for sync).`,
        'info'
      );
      setDeleteUserTarget(null);
      await loadFromIndexedDb(false);
    } catch (err: any) {
      showToast(err?.message || 'Unable to delete member.', 'error');
    } finally {
      setDeleteUserLoading(false);
    }
  };

  // Warehouse CRUD Handlers (IndexedDB + localStorage backup)
  const persistWarehouses = (next: WarehouseItem[]) => {
    setWarehouses(next);
    try {
      localStorage.setItem('agrihub_warehouses', JSON.stringify(next));
    } catch {}
  };

  const openCreateWarehouseModal = () => {
    setEditingWarehouse(null);
    setWhCode(`WH-BD-${String(warehouses.length + 1).padStart(2, '0')}`);
    setWhName('');
    setWhRegion('Dhaka');
    setWhAddress('');
    setWhCapacity('1000');
    setWhOccupied('320');
    setWhTempRange('2°C - 6°C');
    setWhManager('');
    setWhStatus('operational');
    setWarehouseModalOpen(true);
  };

  const openEditWarehouseModal = (w: WarehouseItem) => {
    setEditingWarehouse(w);
    setWhCode(w.code);
    setWhName(w.name);
    setWhRegion(w.region);
    setWhAddress(w.address);
    setWhCapacity(String(w.capacityTons));
    setWhOccupied(String(w.occupiedTons));
    setWhTempRange(w.tempRangeCelsius);
    setWhManager(w.managerName);
    setWhStatus(w.status);
    setWarehouseModalOpen(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim() || !whCode.trim()) return;
    const saved = await saveWarehouseOfflineFirst(
      {
        id: editingWarehouse?.id,
        code: whCode.trim().toUpperCase(),
        name: whName.trim(),
        region: whRegion.trim(),
        address: whAddress.trim(),
        capacityTons: Number(whCapacity) || 500,
        occupiedTons: Number(whOccupied) || 0,
        tempRangeCelsius: whTempRange.trim() || '2°C - 6°C',
        managerName: whManager.trim() || 'Hub Supervisor',
        status: whStatus
      },
      editingWarehouse ? 'update' : 'create'
    );
    const next = editingWarehouse
      ? warehouses.map(w => (w.id === editingWarehouse.id ? saved : w))
      : [saved, ...warehouses];
    persistWarehouses(next);
    setWarehouseModalOpen(false);
    showToast(`Warehouse '${saved.name}' saved.`);
  };

  const handleDeleteWarehouse = async (id: number) => {
    const target = warehouses.find((w) => w.id === id);
    if (target) {
      await deleteWarehouseOfflineFirst({
        ...target,
        syncStatus: 'synced',
        localUpdatedAt: new Date().toISOString()
      });
    }
    persistWarehouses(warehouses.filter(w => w.id !== id));
    showToast('Warehouse hub removed.', 'info');
  };

  // CSV Export Helper for Reports
  const downloadCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
    const escapeCell = (val: string | number) => `"${String(val ?? '').replace(/"/g, '""')}"`;
    const csv = [headers.map(escapeCell).join(','), ...rows.map(r => r.map(escapeCell).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${filename}`);
  };

  // Copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const gq = globalSearch.toLowerCase().trim();

  // Filtered Categories
  const filteredCategories = useMemo(() => {
    const q = (categorySearch || gq).toLowerCase().trim();
    return categories.filter(c => {
      const matchSearch =
        q === '' ||
        c.name.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        (c.description || '').toLowerCase().includes(q);

      const matchUsage =
        categoryUsageFilter === 'all' ||
        (categoryUsageFilter === 'with_products' && (c.skuCount || 0) > 0) ||
        (categoryUsageFilter === 'empty' && (c.skuCount || 0) === 0);

      return matchSearch && matchUsage;
    });
  }, [categories, categorySearch, categoryUsageFilter, gq]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    const q = (productSearch || gq).toLowerCase().trim();
    return products.filter(p => {
      const matchSearch =
        q === '' ||
        p.title.toLowerCase().includes(q) ||
        p.batchNumber.toLowerCase().includes(q) ||
        p.farmerName.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q);

      const matchCat = selectedCategoryFilter === 'all' || p.category === selectedCategoryFilter;
      const matchOrganic = !organicOnly || p.isOrganic;
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;

      return matchSearch && matchCat && matchOrganic && matchStatus;
    });
  }, [products, productSearch, selectedCategoryFilter, organicOnly, statusFilter, gq]);

  const producerOptions = useMemo(() => {
    const list = users.filter(u => u.role === 'farmer' || u.role === 'admin');
    if (list.length > 0) return list;
    if (currentUser) {
      return [
        {
          id: Number(currentUser.id),
          role: currentUser.role,
          full_name: currentUser.full_name,
          business_name: currentUser.business_name || ''
        }
      ];
    }
    return [];
  }, [users, currentUser]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchStatus = orderStatusFilter === 'all' || o.orderStatus === orderStatusFilter;
      const matchGlobal =
        gq === '' ||
        o.orderNumber.toLowerCase().includes(gq) ||
        o.buyerName.toLowerCase().includes(gq) ||
        o.productTitle.toLowerCase().includes(gq);
      return matchStatus && matchGlobal;
    });
  }, [orders, orderStatusFilter, gq]);

  // Filtered Users (supports /admin/farmers & /admin/buyers views)
  const filteredUsers = useMemo(() => {
    const effectiveRole: RoleFilter =
      activeView === 'farmers' ? 'farmer' : activeView === 'buyers' ? 'buyer' : userRoleFilter;
    const q = (userSearch || gq).toLowerCase().trim();
    return users.filter(u => {
      const matchRole = effectiveRole === 'all' || u.role === effectiveRole;
      const matchSearch =
        q === '' ||
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.business_name || '').toLowerCase().includes(q);
      return matchRole && matchSearch;
    });
  }, [users, userRoleFilter, userSearch, activeView, gq]);

  const filteredWarehouses = useMemo(() => {
    const q = (warehouseSearch || gq).toLowerCase().trim();
    return warehouses.filter(w =>
      q === '' ||
      w.name.toLowerCase().includes(q) ||
      w.code.toLowerCase().includes(q) ||
      w.region.toLowerCase().includes(q)
    );
  }, [warehouses, warehouseSearch, gq]);

  const inTransitCount = adminStats?.logistics?.active_shipments ?? shipments.filter(s => s.status === 'in_transit' || s.status === 'dispatched').length;

  // Real MySQL Category Distribution for Donut Chart
  const categoryBreakdown = useMemo(() => {
    const raw = adminStats?.categories || [];
    const totalCount = raw.reduce((sum, item) => sum + Number(item.product_count || 0), 0);
    if (totalCount === 0) return [];
    let cumulative = 0;
    const circumference = 2 * Math.PI * 38;
    return raw
      .filter(item => Number(item.product_count) > 0)
      .map((item, idx) => {
        const count = Number(item.product_count);
        const share = Math.round((count / totalCount) * 100);
        const arcLength = (count / totalCount) * circumference;
        const dashOffset = -cumulative;
        cumulative += arcLength;
        return {
          id: item.id,
          name: item.name,
          count,
          stockUnits: Number(item.total_stock_units || 0),
          share,
          color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
          dashArray: `${arcLength.toFixed(1)} ${circumference.toFixed(1)}`,
          dashOffset: dashOffset.toFixed(1)
        };
      });
  }, [adminStats]);

  const totalCategoryProducts = useMemo(
    () => (adminStats?.categories || []).reduce((sum, item) => sum + Number(item.product_count || 0), 0),
    [adminStats]
  );

  // Real Operational Alerts from live MySQL records
  const operationalAlerts = useMemo(() => {
    const alerts: { id: string; title: string; detail: string; tone: 'amber' | 'emerald' }[] = [];
    products
      .filter(p => p.status === 'low_stock' || p.status === 'out_of_stock')
      .slice(0, 3)
      .forEach(p => {
        alerts.push({
          id: `prod-${p.id}`,
          title: p.status === 'out_of_stock' ? 'Batch Out of Stock' : 'Low Stock Batch',
          detail: `${p.batchNumber} (${p.title}) — ${p.quantityAvailable.toLocaleString()} ${p.unitType} remaining.`,
          tone: 'amber'
        });
      });
    shipments
      .filter(s => s.status === 'delayed')
      .slice(0, 2)
      .forEach(s => {
        alerts.push({
          id: `ship-${s.id}`,
          title: 'Shipment Delayed',
          detail: `Waybill ${s.trackingCode} (${s.originHub} → ${s.destinationHub}) is marked delayed.`,
          tone: 'amber'
        });
      });
    return alerts;
  }, [products, shipments]);

  const unreadAlerts = useMemo(
    () => operationalAlerts.filter((a) => !readAlertIds.includes(a.id)),
    [operationalAlerts, readAlertIds]
  );

  const markAlertRead = (alertId: string) => {
    setReadAlertIds((prev) => {
      if (prev.includes(alertId)) return prev;
      const next = [...prev, alertId];
      try {
        localStorage.setItem('agrihub_read_alerts', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const markAllAlertsRead = () => {
    const allIds = Array.from(new Set([...readAlertIds, ...operationalAlerts.map((a) => a.id)]));
    setReadAlertIds(allIds);
    try {
      localStorage.setItem('agrihub_read_alerts', JSON.stringify(allIds));
    } catch {}
    showToast(tr('All notifications marked as read.', 'সকল বিজ্ঞপ্তি পঠিত হিসেবে চিহ্নিত হয়েছে।'));
  };

  const openProfileEditModal = () => {
    setProfFullName(currentUser?.full_name || 'System Administrator');
    setProfEmail(currentUser?.email || 'admin@agrihub.com');
    setProfPhone(currentUser?.phone || '+880 1700-000001');
    setProfBusiness(currentUser?.business_name || 'AgriHub Central HQ');
    setProfAddress(currentUser?.address || 'Dhaka Central Operations Centre');
    setProfileModalOpen(true);
  };

  const handleSaveAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profFullName.trim()) return;
    setProfSaving(true);
    try {
      const updated = await updateCurrentUserProfile({
        full_name: profFullName,
        email: profEmail,
        phone: profPhone,
        business_name: profBusiness,
        address: profAddress
      });
      setCurrentUser(updated);
      // Also update matching offlineDb user record if present
      if (updated?.id) {
        const existingUser = await offlineDb.users.get(Number(updated.id));
        if (existingUser) {
          await offlineDb.users.update(Number(updated.id), {
            full_name: updated.full_name,
            phone: updated.phone,
            business_name: updated.business_name,
            address: updated.address,
            localUpdatedAt: new Date().toISOString()
          });
          setUsers((prev) =>
            prev.map((u) =>
              u.id === Number(updated.id)
                ? {
                    ...u,
                    full_name: updated.full_name,
                    phone: updated.phone,
                    business_name: updated.business_name,
                    address: updated.address
                  }
                : u
            )
          );
        }
      }
      setProfileModalOpen(false);
      showToast(tr('Administrator profile updated.', 'অ্যাডমিন প্রোফাইল হালনাগাদ হয়েছে।'));
    } finally {
      setProfSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09110d] text-slate-800 dark:text-slate-100 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900 dark:selection:bg-emerald-900/60 dark:selection:text-emerald-100 transition-colors">
      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium transition-all bg-white dark:bg-[#101c16] animate-in fade-in slide-in-from-top-2 border-slate-200 dark:border-emerald-900/60">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />}
          {toast.type === 'info' && <RefreshCw className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />}
          <span className="text-slate-800 dark:text-slate-100">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* ================= 1. COLLAPSIBLE ENTERPRISE SIDEBAR ================= */}
        <aside
          className={`bg-white dark:bg-[#0e1913] border-r border-slate-200 dark:border-emerald-900/50 flex flex-col justify-between transition-all duration-200 z-30 ${
            sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
          } hidden lg:flex`}
        >
          {/* Top Brand & Tenant Selector */}
          <div>
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100 dark:border-emerald-900/40">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="inline-flex items-center rounded-lg dark:bg-white/95 dark:px-1.5 dark:py-0.5 shrink-0">
                  <img
                    src="/agrihub-logo.png"
                    alt="AgriHub"
                    className="h-8 w-auto object-contain shrink-0"
                  />
                </span>
                {!sidebarCollapsed && (
                  <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/70 shrink-0">
                    Console
                  </span>
                )}
              </div>
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-[#13221a] transition"
                title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              >
                {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>

            {/* Trade Network Badge */}
            {!sidebarCollapsed && (
              <div className="p-3">
                <div className="bg-emerald-50/70 dark:bg-emerald-950/50 border border-emerald-200/80 dark:border-emerald-800/60 rounded-lg px-2.5 py-2 flex items-center gap-2 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                  <span className="font-semibold text-emerald-900 dark:text-emerald-200 truncate">AgriHub Network</span>
                </div>
              </div>
            )}

            {/* Navigation Menus */}
            <nav className="p-3 space-y-5 overflow-y-auto">
              {/* Group 1: Operations */}
              <div>
                {!sidebarCollapsed && (
                  <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {tr('Operations', 'অপারেশনস')}
                  </div>
                )}
                <div className="space-y-1">
                  <button
                    onClick={() => goToView('dashboard')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeView === 'dashboard'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#13221a]'
                    }`}
                    title={tr('Executive Dashboard', 'ড্যাশবোর্ড')}
                  >
                    <Layers className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-400" />
                    {!sidebarCollapsed && <span>{tr('Dashboard', 'ড্যাশবোর্ড')}</span>}
                  </button>

                  <button
                    onClick={() => goToView('orders')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeView === 'orders'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#13221a]'
                    }`}
                    title={tr('Wholesale Orders', 'অর্ডারসমূহ')}
                  >
                    <div className="flex items-center gap-3">
                      <ShoppingBag className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                      {!sidebarCollapsed && <span>{tr('Orders', 'অর্ডার')}</span>}
                    </div>
                    {!sidebarCollapsed && (
                      <span className="text-xs font-mono bg-slate-100 dark:bg-[#13221a] text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-semibold">
                        {orders.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => goToView('logistics')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeView === 'logistics'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#13221a]'
                    }`}
                    title={tr('Logistics & Fleets', 'লজিস্টিকস')}
                  >
                    <div className="flex items-center gap-3">
                      <Truck className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                      {!sidebarCollapsed && <span>{tr('Logistics', 'লজিস্টিকস')}</span>}
                    </div>
                    {!sidebarCollapsed && inTransitCount > 0 && (
                      <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/80 px-1.5 py-0.5 rounded font-bold">
                        {inTransitCount} {tr('live', 'সক্রিয়')}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => goToView('warehouses')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeView === 'warehouses'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#13221a]'
                    }`}
                    title={tr('Regional Warehouses', 'হিমাগার ও গুদাম')}
                  >
                    <div className="flex items-center gap-3">
                      <Warehouse className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                      {!sidebarCollapsed && <span>{tr('Warehouses', 'হিমাগার')}</span>}
                    </div>
                    {!sidebarCollapsed && (
                      <span className="text-xs font-mono bg-slate-100 dark:bg-[#13221a] text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-semibold">
                        {warehouses.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Group 2: Catalog & Members */}
              <div>
                {!sidebarCollapsed && (
                  <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {tr('Catalog & Network', 'ক্যাটালগ ও সদস্য')}
                  </div>
                )}
                <div className="space-y-1">
                  <button
                    onClick={() => goToView('batches')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeView === 'batches'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#13221a]'
                    }`}
                    title={tr('Harvest Batches', 'ফসলের ব্যাচ')}
                  >
                    <div className="flex items-center gap-3">
                      <Sprout className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                      {!sidebarCollapsed && <span>{tr('Products', 'পণ্য ও ব্যাচ')}</span>}
                    </div>
                    {!sidebarCollapsed && (
                      <span className="text-xs font-mono bg-slate-100 dark:bg-[#13221a] text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded font-semibold">
                        {products.length}
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => goToView('categories')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeView === 'categories'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#13221a]'
                    }`}
                    title={tr('Produce Categories', 'বিভাগসমূহ')}
                  >
                    <Layers className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                    {!sidebarCollapsed && <span>{tr('Categories', 'বিভাগসমূহ')}</span>}
                  </button>

                  <button
                    onClick={() => goToView('farmers')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeView === 'farmers'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#13221a]'
                    }`}
                    title={tr('Farmers Directory', 'কৃষক তালিকা')}
                  >
                    <UserCheck className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                    {!sidebarCollapsed && <span>{tr('Farmers', 'কৃষক')}</span>}
                  </button>

                  <button
                    onClick={() => goToView('buyers')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeView === 'buyers'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#13221a]'
                    }`}
                    title={tr('Buyers Directory', 'ক্রেতা তালিকা')}
                  >
                    <Store className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                    {!sidebarCollapsed && <span>{tr('Buyers', 'ক্রেতা')}</span>}
                  </button>

                  <button
                    onClick={() => goToView('users')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeView === 'users'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#13221a]'
                    }`}
                    title={tr('All Members', 'সব ব্যবহারকারী')}
                  >
                    <Users className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                    {!sidebarCollapsed && <span>{tr('All Users', 'ব্যবহারকারী')}</span>}
                  </button>
                </div>
              </div>

              {/* Group 3: Analytics & Preferences */}
              <div>
                {!sidebarCollapsed && (
                  <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    {tr('Insights & Control', 'রিপোর্ট ও সেটিংস')}
                  </div>
                )}
                <div className="space-y-1">
                  <button
                    onClick={() => goToView('reports')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeView === 'reports'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#13221a]'
                    }`}
                    title={tr('Trade Reports', 'বাণিজ্য রিপোর্ট')}
                  >
                    <BarChart3 className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                    {!sidebarCollapsed && <span>{tr('Reports', 'রিপোর্ট')}</span>}
                  </button>

                  <button
                    onClick={() => goToView('audit')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeView === 'audit'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#13221a]'
                    }`}
                    title={tr('Activity History', 'কার্যক্রম ইতিহাস')}
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                    {!sidebarCollapsed && <span>{tr('Activity', 'কার্যক্রম')}</span>}
                  </button>

                  <button
                    onClick={() => goToView('settings')}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeView === 'settings'
                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-semibold shadow-2xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-[#13221a]'
                    }`}
                    title={tr('Console Settings', 'সেটিংস')}
                  >
                    <Settings className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                    {!sidebarCollapsed && <span>{tr('Settings', 'সেটিংস')}</span>}
                  </button>
                </div>
              </div>
            </nav>
          </div>

          {/* Bottom Current User Card & Sign Out */}
          <div className="p-3 border-t border-slate-100 dark:border-emerald-900/40">
            {currentUser ? (
              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-[#13221a] border border-slate-200/80 dark:border-emerald-900/50">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-xs shrink-0">
                    {currentUser.full_name?.charAt(0) || 'U'}
                  </div>
                  {!sidebarCollapsed && (
                    <div className="truncate text-left">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 text-xs truncate leading-tight">
                        {currentUser.full_name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 capitalize">{currentUser.role}</div>
                    </div>
                  )}
                </div>
                {!sidebarCollapsed && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={openProfileEditModal}
                      className="text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 p-1 rounded transition"
                      title={tr('Edit Profile', 'প্রোফাইল সম্পাদনা')}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded transition"
                      title="Sign Out"
                    >
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition"
              >
                <LogIn className="w-4 h-4" />
                {!sidebarCollapsed && <span>Sign In</span>}
              </button>
            )}
          </div>
        </aside>

        {/* ================= 2. MAIN APPLICATION VIEWPORT ================= */}
        <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {/* STICKY TOP UTILITY BAR (64px) */}
          <header className="h-16 bg-white dark:bg-[#0e1913] border-b border-slate-200 dark:border-emerald-900/50 sticky top-0 z-20 px-4 lg:px-8 flex items-center justify-between gap-4 shrink-0 shadow-2xs">
            {/* Left: Mobile trigger & Breadcrumbs */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open admin navigation"
                className="lg:hidden p-2 text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-[#13221a]"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-400 dark:text-slate-500">AgriHub</span>
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <span className="font-medium text-slate-600 dark:text-slate-300 capitalize">
                  {activeView === 'dashboard' || activeView === 'orders' || activeView === 'logistics' || activeView === 'warehouses'
                    ? 'Operations'
                    : activeView === 'reports' || activeView === 'docs' || activeView === 'settings' || activeView === 'audit'
                    ? 'Insights'
                    : 'Network'}
                </span>
                <span className="text-slate-300 dark:text-slate-600">/</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 capitalize">
                  {activeView === 'batches'
                    ? tr('Products & Batches', 'পণ্য ও ব্যাচ')
                    : activeView === 'audit'
                    ? tr('Activity History', 'কার্যক্রম ইতিহাস')
                    : activeView === 'docs'
                    ? tr('Docs & Pitch Deck', 'ডকস ও পিচ ডেক')
                    : activeView}
                </span>
              </div>
            </div>

            {/* Center: Global Search Bar */}
            <div className="hidden md:flex flex-1 max-w-md mx-4">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  ref={globalSearchInputRef}
                  type="text"
                  value={globalSearch}
                  onChange={e => setGlobalSearch(e.target.value)}
                  placeholder={tr(
                    'Search harvest batch, crop, buyer, or order ID...',
                    'ফসল, ব্যাচ কোড, ক্রেতা বা অর্ডার খুঁজুন...'
                  )}
                  className="w-full bg-slate-50 dark:bg-[#101c16] hover:bg-slate-100/70 dark:hover:bg-[#13221a] focus:bg-white dark:focus:bg-[#101c16] text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 pl-9 pr-12 py-2 rounded-lg border border-slate-200 dark:border-emerald-900/60 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition"
                />
                {globalSearch ? (
                  <button
                    type="button"
                    onClick={() => setGlobalSearch('')}
                    aria-label="Clear global search"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] bg-white dark:bg-[#0b1510] border border-slate-200 dark:border-emerald-900/60 text-slate-400 px-1.5 py-0.5 rounded shadow-2xs">
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>

            {/* Right: Language Toggle, Marketplace Link, Notifications, and Primary CTA */}
            <div className="flex items-center gap-2">
              {/* Language Toggle */}
              <button
                type="button"
                onClick={toggleLanguage}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-[#101c16] hover:bg-emerald-50 dark:hover:bg-[#13221a] hover:border-emerald-300 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-emerald-800 dark:hover:text-emerald-300 transition"
                title={tr('Switch to বাংলা', 'Switch to English')}
              >
                <Globe className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>{language === 'en' ? 'বাংলা' : 'EN'}</span>
              </button>

              {/* Link to Public Marketplace */}
              <Link
                to="/marketplace"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-emerald-900/60 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-slate-50 dark:hover:bg-[#13221a] transition"
              >
                <ShoppingBag className="w-3.5 h-3.5 text-slate-400" />
                <span>{tr('View Marketplace', 'মার্কেটপ্লেস')}</span>
              </Link>

              {/* Notification Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="p-2 text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#13221a] rounded-lg relative transition"
                  title={tr('Notifications', 'বিজ্ঞপ্তি')}
                >
                  <Bell className="w-4 h-4" />
                  {unreadAlerts.length > 0 && (
                    <span className="w-2 h-2 bg-amber-500 rounded-full absolute top-1.5 right-1.5" />
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-[#101c16] border border-slate-200 dark:border-emerald-900/60 rounded-xl shadow-xl p-3 z-50 text-xs">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-emerald-900/40">
                      <div className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <span>{tr('Operational Alerts', 'অপারেশন সতর্কতা')}</span>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                          {formatNumber(unreadAlerts.length, language)} {tr('unread', 'অপঠিত')}
                        </span>
                      </div>
                      {unreadAlerts.length > 0 && (
                        <button
                          type="button"
                          onClick={markAllAlertsRead}
                          className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>{tr('Mark all read', 'সবগুলো পঠিত করুন')}</span>
                        </button>
                      )}
                    </div>
                    <div className="py-2 space-y-2 max-h-80 overflow-y-auto">
                      {operationalAlerts.length === 0 ? (
                        <div className="p-3 bg-slate-50 dark:bg-[#0b1510] border border-slate-200/70 dark:border-emerald-900/40 rounded-lg text-slate-500 dark:text-slate-400 text-center">
                          {tr('No active inventory or shipment alerts.', 'কোনো স্টক বা পরিবহন সতর্কতা নেই।')}
                        </div>
                      ) : (
                        operationalAlerts.map(alert => {
                          const isRead = readAlertIds.includes(alert.id);
                          return (
                            <button
                              key={alert.id}
                              type="button"
                              onClick={() => markAlertRead(alert.id)}
                              className={`w-full text-left p-2.5 rounded-lg border transition ${
                                isRead
                                  ? 'bg-slate-50 dark:bg-[#0b1510] border-slate-200/70 dark:border-emerald-900/30 opacity-70'
                                  : alert.tone === 'amber'
                                  ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-200/80 dark:border-amber-900/60'
                                  : 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200/80 dark:border-emerald-900/60'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span
                                  className={`font-semibold ${
                                    isRead
                                      ? 'text-slate-700 dark:text-slate-300'
                                      : 'text-amber-900 dark:text-amber-300'
                                  }`}
                                >
                                  {alert.title}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                                  {isRead ? tr('Read', 'পঠিত') : tr('New', 'নতুন')}
                                </span>
                              </div>
                              <div className="text-slate-700 dark:text-slate-300 mt-0.5">{alert.detail}</div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* + Register Harvest Batch Quick Action Button */}
              <button
                onClick={openCreateProductDrawer}
                className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden sm:inline">{tr('Register Harvest Batch', 'নতুন ব্যাচ যোগ')}</span>
                <span className="sm:hidden">{tr('New Batch', 'নতুন')}</span>
              </button>
            </div>
          </header>

          {/* MAIN CONTENT CONTAINER */}
          <main className="flex-1 p-4 lg:p-6 max-w-7xl w-full mx-auto space-y-6">
            {/* Offline-First Sync Status Bar, Queue Monitor & Conflict Resolver */}
            <OfflineSyncBar />

            {/* ================= VIEW 1: EXECUTIVE DASHBOARD ================= */}
            {activeView === 'dashboard' && (
              <div className="space-y-6">
                {/* Dashboard Toolbar & Error Handling */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                      {tr('Operations Overview', 'অপারেশনস সংক্ষিপ্ত বিবরণ')}
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {tr('Real-time platform metrics across users, inventory, orders, and logistics', 'ব্যবহারকারী, মজুদ, অর্ডার ও পরিবহনের রিয়েল-টাইম তথ্য')}
                    </p>
                  </div>
                  <button
                    onClick={checkConnectionAndLoad}
                    disabled={loadingData}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#101c16] hover:bg-slate-50 dark:hover:bg-[#13221a] text-xs font-semibold text-slate-700 dark:text-slate-200 transition disabled:opacity-60"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 ${loadingData ? 'animate-spin' : ''}`} />
                    <span>{loadingData ? tr('Syncing...', 'সিঙ্ক হচ্ছে...') : tr('Refresh Stats', 'রিফ্রেশ')}</span>
                  </button>
                </div>

                {dashboardError && (
                  <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-red-900 dark:text-red-300">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                      <div>
                        <span className="font-semibold">{tr('Unable to load live dashboard metrics:', 'ড্যাশবোর্ড তথ্য লোড করা যায়নি:')} </span>
                        <span>{dashboardError}</span>
                      </div>
                    </div>
                    <button
                      onClick={checkConnectionAndLoad}
                      className="px-3 py-1.5 bg-white dark:bg-[#101c16] border border-red-200 dark:border-red-800/70 hover:bg-red-100 dark:hover:bg-red-950 text-red-800 dark:text-red-300 font-semibold rounded-lg transition"
                    >
                      {tr('Retry', 'আবার চেষ্টা করুন')}
                    </button>
                  </div>
                )}

                {/* Row 1 — 5 KPI Cards (Users, Products, Orders, Active Shipments, Revenue) */}
                {loadingData && !adminStats ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {[1, 2, 3, 4, 5].map(idx => (
                      <div key={idx} className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 p-5 rounded-xl shadow-2xs animate-pulse space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="h-3 w-24 bg-slate-200 dark:bg-emerald-950/70 rounded" />
                          <div className="h-5 w-14 bg-slate-100 dark:bg-[#13221a] rounded" />
                        </div>
                        <div className="h-7 w-20 bg-slate-200 dark:bg-emerald-950/70 rounded" />
                        <div className="h-3 w-36 bg-slate-100 dark:bg-[#13221a] rounded" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    {/* KPI 1: Total Users */}
                    <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 p-5 rounded-xl shadow-2xs">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                          <span>{tr('Total Users', 'মোট ব্যবহারকারী')}</span>
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 font-semibold px-1.5 py-0.5 rounded text-[11px]">
                          {adminStats ? `${formatNumber(adminStats.users.verified_total ?? adminStats.users.verified_farmers, language)} ${tr('verified', 'যাচাইকৃত')}` : '—'}
                        </span>
                      </div>
                      <div className="mt-2.5 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                        {adminStats ? formatNumber(adminStats.users.total, language) : '—'}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {adminStats
                          ? `${formatNumber(adminStats.users.by_role?.farmer ?? 0, language)} ${tr('farmers', 'কৃষক')} · ${formatNumber(adminStats.users.by_role?.buyer ?? 0, language)} ${tr('buyers', 'ক্রেতা')} · ${formatNumber(adminStats.users.by_role?.supplier ?? 0, language)} ${tr('carriers', 'পরিবহন')}`
                          : tr('Awaiting live stats', 'তথ্যের অপেক্ষায়')}
                      </div>
                    </div>

                    {/* KPI 2: Total Products */}
                    <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 p-5 rounded-xl shadow-2xs">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Sprout className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                          <span>{tr('Total Products', 'মোট পণ্য')}</span>
                        </span>
                        <span className="text-slate-500 dark:text-slate-300 bg-slate-100 dark:bg-[#13221a] font-semibold px-1.5 py-0.5 rounded text-[11px]">
                          {tr('Active lots', 'সক্রিয় লট')}
                        </span>
                      </div>
                      <div className="mt-2.5 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                        {adminStats ? formatNumber(adminStats.products.total_active, language) : '—'}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {adminStats
                          ? `${formatNumber(adminStats.products.total_stock_units, language)} ${tr('units in stock', 'ইউনিট মজুদ')}`
                          : tr('Awaiting live stats', 'তথ্যের অপেক্ষায়')}
                      </div>
                    </div>

                    {/* KPI 3: Total Orders */}
                    <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 p-5 rounded-xl shadow-2xs">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <ShoppingBag className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                          <span>{tr('Total Orders', 'মোট অর্ডার')}</span>
                        </span>
                        <span className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 font-semibold px-1.5 py-0.5 rounded text-[11px]">
                          {adminStats ? `${formatNumber(adminStats.orders.pending_orders ?? 0, language)} ${tr('pending', 'অপেক্ষমাণ')}` : '—'}
                        </span>
                      </div>
                      <div className="mt-2.5 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                        {adminStats ? formatNumber(adminStats.orders.total_count, language) : '—'}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {tr('Wholesale purchase contracts', 'পাইকারি ক্রয় চুক্তি')}
                      </div>
                    </div>

                    {/* KPI 4: Active Shipments */}
                    <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 p-5 rounded-xl shadow-2xs">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <span className="flex items-center gap-1.5">
                          <Truck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                          <span>{tr('Active Shipments', 'সক্রিয় চালান')}</span>
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 font-semibold px-1.5 py-0.5 rounded text-[11px]">
                          {adminStats ? `${formatNumber(adminStats.logistics.delivered_shipments ?? 0, language)} ${tr('delivered', 'ডেলিভারি')}` : '—'}
                        </span>
                      </div>
                      <div className="mt-2.5 text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                        {adminStats ? formatNumber(adminStats.logistics.active_shipments, language) : '—'}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {adminStats
                          ? `${formatNumber(adminStats.logistics.total_shipments ?? adminStats.logistics.active_shipments, language)} ${tr('total shipments', 'মোট চালান')}`
                          : tr('Awaiting live stats', 'তথ্যের অপেক্ষায়')}
                      </div>
                    </div>

                    {/* KPI 5: Revenue */}
                    <div className="bg-white dark:bg-[#101c16] border border-emerald-200 dark:border-emerald-800/70 p-5 rounded-xl shadow-2xs bg-gradient-to-br from-white to-emerald-50/30 dark:from-[#101c16] dark:to-emerald-950/40">
                      <div className="flex items-center justify-between text-xs text-emerald-900 dark:text-emerald-300 font-semibold">
                        <span className="flex items-center gap-1.5">
                          <Banknote className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                          <span>{tr('Revenue', 'মোট আয়')}</span>
                        </span>
                        <span className="text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/80 font-semibold px-1.5 py-0.5 rounded text-[11px]">
                          {tr('Orders GMV', 'মোট মূল্য')}
                        </span>
                      </div>
                      <div className="mt-2.5 text-xl xl:text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono tabular-nums">
                        {adminStats
                          ? formatCurrency(adminStats.orders.total_revenue ?? adminStats.orders.total_gmv, language)
                          : '—'}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {adminStats
                          ? `${formatCurrency(adminStats.orders.paid_revenue ?? 0, language)} ${tr('paid', 'পরিশোধিত')} · ${formatCurrency(adminStats.orders.escrow_revenue ?? 0, language)} ${tr('protected', 'সুরক্ষিত')}`
                          : tr('Awaiting live stats', 'তথ্যের অপেক্ষায়')}
                      </div>
                    </div>
                  </div>
                )}

                {/* Row 2 — Recent Activity & Category Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left 7 cols: Recent Activity */}
                  <div className="lg:col-span-7 bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl shadow-2xs flex flex-col justify-between overflow-hidden">
                    <div className="p-5 border-b border-slate-100 dark:border-emerald-900/40 flex items-center justify-between gap-4">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          <span>{tr('Recent Activity', 'সাম্প্রতিক কার্যক্রম')}</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {tr('Latest verified user, inventory, and order events', 'সর্বশেষ অ্যাকাউন্ট, পণ্য ও অর্ডার কার্যক্রম')}
                        </p>
                      </div>
                      <button
                        onClick={() => goToView('audit')}
                        className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-semibold flex items-center gap-1 shrink-0"
                      >
                        <span>{tr('View Activity Log', 'সম্পূর্ণ ইতিহাস')}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex-1 divide-y divide-slate-100 dark:divide-emerald-900/40">
                      {loadingData && recentActivity.length === 0 ? (
                        <div className="p-5 space-y-3">
                          {[1, 2, 3, 4].map(idx => (
                            <div key={idx} className="flex items-center justify-between gap-4 animate-pulse">
                              <div className="space-y-1.5 flex-1">
                                <div className="h-3.5 w-40 bg-slate-200 dark:bg-emerald-950/70 rounded" />
                                <div className="h-3 w-64 bg-slate-100 dark:bg-[#13221a] rounded" />
                              </div>
                              <div className="h-3 w-24 bg-slate-100 dark:bg-[#13221a] rounded" />
                            </div>
                          ))}
                        </div>
                      ) : dashboardError && recentActivity.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                          <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
                          <p className="font-semibold text-slate-700 dark:text-slate-200">{tr('Could not load activity history', 'কার্যক্রমের ইতিহাস লোড করা যায়নি')}</p>
                          <p>{dashboardError}</p>
                        </div>
                      ) : recentActivity.length === 0 ? (
                        <div className="p-10 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                          <ShieldCheck className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
                          <p className="font-semibold text-slate-700 dark:text-slate-200">No recent activity recorded</p>
                          <p>Events will appear here as users sign in, list batches, or place orders.</p>
                        </div>
                      ) : (
                        recentActivity.slice(0, 6).map((log, idx) => (
                          <button
                            key={`recent-${log.id}-${idx}`}
                            type="button"
                            onClick={() => setInspectAuditLog(log)}
                            className="w-full text-left px-5 py-3.5 hover:bg-slate-50/80 dark:hover:bg-[#13221a] transition flex items-center justify-between gap-4"
                          >
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/80 dark:border-emerald-800/70 px-1.5 py-0.5 rounded">
                                  {log.action}
                                </span>
                                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                                  {log.actor}
                                </span>
                                <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-[#13221a] px-1.5 py-0.5 rounded">
                                  {log.role}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                Target: <span className="font-medium text-slate-700 dark:text-slate-300">{log.target}</span> · IP{' '}
                                <span className="font-mono">{log.ip_address}</span>
                              </div>
                            </div>
                            <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0 text-right">
                              {log.created_at}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Right 5 cols: Real Category Breakdown */}
                  <div className="lg:col-span-5 bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {tr('Inventory by Category', 'বিভাগ অনুযায়ী মজুদ')}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {tr('Active batch distribution across produce categories', 'বিভাগভিত্তিক ফসলের ব্যাচের বণ্টন')}
                      </p>

                      {loadingData && !adminStats ? (
                        <div className="my-6 space-y-4 animate-pulse">
                          <div className="w-36 h-36 rounded-full bg-slate-100 dark:bg-[#13221a] mx-auto" />
                          <div className="space-y-2">
                            {[1, 2, 3].map(idx => (
                              <div key={idx} className="h-3 bg-slate-100 dark:bg-[#13221a] rounded w-full" />
                            ))}
                          </div>
                        </div>
                      ) : dashboardError && !adminStats ? (
                        <div className="my-10 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                          <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto" />
                          <p>Category breakdown is currently unavailable. Please refresh shortly.</p>
                        </div>
                      ) : categoryBreakdown.length === 0 ? (
                        <div className="my-10 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                          <Layers className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
                          <p className="font-semibold text-slate-700 dark:text-slate-200">No active category inventory</p>
                          <p>Register a harvest batch to populate category metrics.</p>
                        </div>
                      ) : (
                        <>
                          <CategoryDoughnutChart
                            segments={categoryBreakdown}
                            totalProducts={totalCategoryProducts}
                            centerLabel={tr('Active Batches', 'সক্রিয় ব্যাচ')}
                          />

                          <div className="space-y-2 text-xs">
                            {categoryBreakdown.map(c => (
                              <div key={c.id} className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: c.color }}
                                  />
                                  <span className="truncate">{c.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 font-mono">
                                  <span className="text-[11px] text-slate-400 dark:text-slate-500">{formatNumber(c.count, language)} lots</span>
                                  <span className="font-semibold text-slate-800 dark:text-slate-200">{formatNumber(c.share, language)}%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Row 3 — Recent Harvest Batches */}
                <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl shadow-2xs overflow-hidden">
                  <div className="p-5 border-b border-slate-100 dark:border-emerald-900/40 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {tr('Recent Harvest Batches', 'সাম্প্রতিক ফসলের ব্যাচ')}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {tr('Latest produce lots in active inventory', 'সর্বশেষ নিবন্ধিত ফসলের লট')}
                      </p>
                    </div>
                    <button
                      onClick={() => goToView('batches')}
                      className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-semibold flex items-center gap-1"
                    >
                      <span>{tr('View All Batches', 'সকল ব্যাচ দেখুন')}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 dark:bg-[#0c1611] text-slate-500 dark:text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-100 dark:border-emerald-900/40">
                        <tr>
                          <th className="py-3 px-4">Produce Title</th>
                          <th className="py-3 px-4">Batch ID</th>
                          <th className="py-3 px-4">Origin Farm</th>
                          <th className="py-3 px-4">Available Stock</th>
                          <th className="py-3 px-4">Target Temp</th>
                          <th className="py-3 px-4">Wholesale Price</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/40">
                        {loadingData && products.length === 0 ? (
                          [1, 2, 3, 4].map(idx => (
                            <tr key={idx} className="animate-pulse">
                              <td className="py-3.5 px-4"><div className="h-3.5 w-40 bg-slate-200 dark:bg-emerald-950/70 rounded" /></td>
                              <td className="py-3.5 px-4"><div className="h-3.5 w-28 bg-slate-100 dark:bg-[#13221a] rounded" /></td>
                              <td className="py-3.5 px-4"><div className="h-3.5 w-32 bg-slate-100 dark:bg-[#13221a] rounded" /></td>
                              <td className="py-3.5 px-4"><div className="h-3.5 w-20 bg-slate-100 dark:bg-[#13221a] rounded" /></td>
                              <td className="py-3.5 px-4"><div className="h-5 w-14 bg-slate-100 dark:bg-[#13221a] rounded" /></td>
                              <td className="py-3.5 px-4"><div className="h-3.5 w-16 bg-slate-100 dark:bg-[#13221a] rounded" /></td>
                              <td className="py-3.5 px-4 text-right"><div className="h-5 w-6 bg-slate-100 dark:bg-[#13221a] rounded ml-auto" /></td>
                            </tr>
                          ))
                        ) : products.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-10 px-4 text-center text-slate-500 dark:text-slate-400">
                              {tr('No harvest batches found.', 'কোনো ফসলের ব্যাচ পাওয়া যায়নি।')}
                            </td>
                          </tr>
                        ) : (
                          products.slice(0, 5).map(p => (
                            <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-[#13221a]/60 transition">
                              <td className="py-3 px-4 font-semibold text-slate-900 dark:text-slate-100">
                                <div className="flex items-center gap-2">
                                  <span>{p.title}</span>
                                  {p.isOrganic && (
                                    <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/70 px-1.5 py-0.2 rounded">
                                      ORGANIC
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono text-emerald-700 dark:text-emerald-400 font-semibold">{p.batchNumber}</td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-300 truncate max-w-xs">{p.farmerName}</td>
                              <td className="py-3 px-4 font-mono">
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {formatNumber(p.quantityAvailable, language)} {p.unitType}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <span className="inline-flex items-center gap-1 font-mono text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/70 px-2 py-0.5 rounded text-[11px]">
                                  <Thermometer className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                                  {p.storageTempCelsius}°C
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                {formatCurrency(p.unitPrice, language)}/{p.unitType}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => setInspectProduct(p)}
                                  className="text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 p-1 rounded hover:bg-slate-100 dark:hover:bg-[#13221a] transition"
                                  title="Inspect Batch Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ================= VIEW 2: HARVEST BATCHES (PRODUCTS CRUD) ================= */}
            {activeView === 'batches' && (
              <div className="space-y-4">
                {/* Header & Controls */}
                <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {tr('Harvest Batches & Product Inventory', 'ফসলের ব্যাচ ও পণ্য তালিকা')}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {tr('Manage farm harvest lots, certified producers, and produce categories', 'খামারের ফসলের লট, উৎপাদক ও বিভাগ পরিচালনা করুন')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        onClick={checkConnectionAndLoad}
                        disabled={loadingData}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#13221a] hover:bg-slate-50 dark:hover:bg-[#172a20] text-xs font-semibold text-slate-700 dark:text-slate-200 transition disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 ${loadingData ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                      <button
                        onClick={openCreateProductDrawer}
                        className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Register Harvest Batch</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter Toolbar */}
                  <div className="pt-3 border-t border-slate-100 dark:border-emerald-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={productSearch}
                          onChange={e => setProductSearch(e.target.value)}
                          placeholder="Search crop, batch #, farmer, or category..."
                          className="bg-slate-50 dark:bg-[#0b1510] border border-slate-200 dark:border-emerald-900/60 text-xs text-slate-900 dark:text-slate-100 rounded-lg pl-8 pr-3 py-1.5 w-64 focus:outline-none focus:border-emerald-600 focus:bg-white dark:focus:bg-[#0e1913] transition"
                        />
                      </div>

                      <select
                        value={selectedCategoryFilter}
                        onChange={e => setSelectedCategoryFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-[#0b1510] border border-slate-200 dark:border-emerald-900/60 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-600"
                      >
                        <option value="all">All Categories</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                      </select>

                      <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value)}
                        className="bg-slate-50 dark:bg-[#0b1510] border border-slate-200 dark:border-emerald-900/60 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-600"
                      >
                        <option value="all">All Statuses</option>
                        <option value="active">Active</option>
                        <option value="low_stock">Low Stock</option>
                        <option value="out_of_stock">Out of Stock</option>
                        <option value="archived">Archived</option>
                      </select>

                      <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer ml-1">
                        <input
                          type="checkbox"
                          checked={organicOnly}
                          onChange={e => setOrganicOnly(e.target.checked)}
                          className="rounded border-slate-300 dark:border-emerald-800 text-emerald-700 focus:ring-emerald-600"
                        />
                        <span>Certified Organic</span>
                      </label>
                    </div>

                    <div className="text-slate-400 dark:text-slate-500 font-mono text-xs">
                      Showing {formatNumber(filteredProducts.length, language)} of {formatNumber(products.length, language)} batches
                    </div>
                  </div>
                </div>

                {productsError && (
                  <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-red-900 dark:text-red-300">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                      <span><strong>Error loading products:</strong> {productsError}</span>
                    </div>
                    <button
                      onClick={checkConnectionAndLoad}
                      className="px-3 py-1 bg-white dark:bg-[#101c16] border border-red-200 dark:border-red-800/70 hover:bg-red-100 rounded-lg font-semibold text-red-800 dark:text-red-300"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Structured Data Table */}
                <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 dark:bg-[#0c1611] text-slate-500 dark:text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-100 dark:border-emerald-900/40">
                        <tr>
                          <th className="py-3 px-4">Produce &amp; Farmer</th>
                          <th className="py-3 px-4">Batch Number</th>
                          <th className="py-3 px-4">Category</th>
                          <th className="py-3 px-4">Inventory Level</th>
                          <th className="py-3 px-4">Unit Price</th>
                          <th className="py-3 px-4">Cold-Storage</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/40">
                        {loadingData && products.length === 0 ? (
                          [1, 2, 3, 4, 5].map(idx => (
                            <tr key={idx} className="animate-pulse">
                              <td className="py-3.5 px-4"><div className="h-4 w-44 bg-slate-200 dark:bg-emerald-950/70 rounded" /></td>
                              <td className="py-3.5 px-4"><div className="h-3.5 w-28 bg-slate-100 dark:bg-[#13221a] rounded" /></td>
                              <td className="py-3.5 px-4"><div className="h-3.5 w-24 bg-slate-100 dark:bg-[#13221a] rounded" /></td>
                              <td className="py-3.5 px-4"><div className="h-3.5 w-24 bg-slate-100 dark:bg-[#13221a] rounded" /></td>
                              <td className="py-3.5 px-4"><div className="h-3.5 w-16 bg-slate-100 dark:bg-[#13221a] rounded" /></td>
                              <td className="py-3.5 px-4"><div className="h-5 w-14 bg-slate-100 dark:bg-[#13221a] rounded" /></td>
                              <td className="py-3.5 px-4"><div className="h-5 w-16 bg-slate-100 dark:bg-[#13221a] rounded" /></td>
                              <td className="py-3.5 px-4 text-right"><div className="h-6 w-20 bg-slate-100 dark:bg-[#13221a] rounded ml-auto" /></td>
                            </tr>
                          ))
                        ) : filteredProducts.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="py-12 px-4 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                              <Sprout className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
                              <div className="font-semibold text-slate-700 dark:text-slate-200">
                                {products.length === 0
                                  ? tr('No harvest batches found', 'কোনো ফসলের ব্যাচ পাওয়া যায়নি')
                                  : tr('No harvest batches match your filters', 'ফিল্টারের সাথে কোনো ব্যাচ মেলেনি')}
                              </div>
                              <div className="flex items-center justify-center gap-2 pt-1">
                                {products.length > 0 && (
                                  <button
                                    onClick={() => {
                                      setProductSearch('');
                                      setSelectedCategoryFilter('all');
                                      setStatusFilter('all');
                                      setOrganicOnly(false);
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-emerald-900/60 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-[#13221a]"
                                  >
                                    Clear Filters
                                  </button>
                                )}
                                <button
                                  onClick={openCreateProductDrawer}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                                >
                                  Register Harvest Batch
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredProducts.map(p => {
                            const stockRatio = Math.min(100, Math.round(((p.quantityAvailable || 0) / 10000) * 100));

                            return (
                              <tr key={p.id} className="hover:bg-slate-50/60 dark:hover:bg-[#13221a]/60 transition group">
                                <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                                  <div className="flex items-center gap-3">
                                    {p.imageUrl && (
                                      <img
                                        src={p.imageUrl}
                                        alt={p.title}
                                        referrerPolicy="no-referrer"
                                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-emerald-900/50 shrink-0"
                                      />
                                    )}
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="truncate">{p.title}</span>
                                        {p.isOrganic && (
                                          <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/70 px-1.5 py-0.2 rounded shrink-0">
                                            ORGANIC
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal truncate mt-0.5">
                                        Farmer: {p.farmerName}
                                      </div>
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 font-mono text-emerald-700 dark:text-emerald-400 font-semibold">
                                  {p.batchNumber}
                                </td>

                                <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                                  {p.category}
                                </td>

                                <td className="py-3.5 px-4">
                                  <div className="space-y-1 w-32">
                                    <div className="flex items-center justify-between font-mono text-xs text-slate-800 dark:text-slate-200">
                                      <span>{formatNumber(p.quantityAvailable, language)} {p.unitType}</span>
                                    </div>
                                    <div className="w-full bg-slate-100 dark:bg-[#13221a] rounded-full h-1.5 overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          p.quantityAvailable <= 500 ? 'bg-amber-500' : 'bg-emerald-600'
                                        }`}
                                        style={{ width: `${Math.max(5, stockRatio)}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3.5 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                  {formatCurrency(p.unitPrice, language)}
                                  <span className="text-slate-400 dark:text-slate-500 font-normal text-[11px]">/{p.unitType}</span>
                                </td>

                                <td className="py-3.5 px-4">
                                  <span className="inline-flex items-center gap-1 font-mono text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800/70 px-2 py-0.5 rounded text-[11px]">
                                    <Thermometer className="w-3 h-3 text-sky-600 dark:text-sky-400" />
                                    {p.storageTempCelsius}°C
                                  </span>
                                </td>

                                <td className="py-3.5 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                      p.status === 'active'
                                        ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70'
                                        : p.status === 'low_stock'
                                        ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70'
                                        : p.status === 'archived'
                                        ? 'bg-slate-100 dark:bg-[#13221a] text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-emerald-900/50'
                                        : 'bg-red-50 dark:bg-red-950/70 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/70'
                                    }`}
                                  >
                                    {p.status.replace('_', ' ')}
                                  </span>
                                </td>

                                <td className="py-3.5 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => setInspectProduct(p)}
                                      className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-[#13221a] transition"
                                      title="Inspect Product"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => openEditProductDrawer(p)}
                                      className="text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition"
                                      title="Edit Product"
                                    >
                                      <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => openDeleteProductDialog(p)}
                                      className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/60 transition"
                                      title="Delete Product"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ================= VIEW 3: CATEGORIES CRUD ================= */}
            {activeView === 'categories' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {tr('Produce Categories Management', 'পণ্যের বিভাগ ব্যবস্থাপনা')}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {tr('Create, edit, and organize produce taxonomy categories', 'কৃষিপণ্যের বিভাগ তৈরি ও পরিচালনা করুন')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <button
                        onClick={checkConnectionAndLoad}
                        disabled={loadingData}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#13221a] hover:bg-slate-50 dark:hover:bg-[#172a20] text-xs font-semibold text-slate-700 dark:text-slate-200 transition disabled:opacity-60"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 ${loadingData ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                      </button>
                      <button
                        onClick={openCreateCategoryModal}
                        className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Category</span>
                      </button>
                    </div>
                  </div>

                  {/* Filter Toolbar */}
                  <div className="pt-3 border-t border-slate-100 dark:border-emerald-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={categorySearch}
                          onChange={e => setCategorySearch(e.target.value)}
                          placeholder="Search name, slug, or description..."
                          className="bg-slate-50 dark:bg-[#0b1510] border border-slate-200 dark:border-emerald-900/60 text-xs text-slate-900 dark:text-slate-100 rounded-lg pl-8 pr-3 py-1.5 w-64 focus:outline-none focus:border-emerald-600 focus:bg-white dark:focus:bg-[#0e1913] transition"
                        />
                      </div>

                      <select
                        value={categoryUsageFilter}
                        onChange={e => setCategoryUsageFilter(e.target.value as any)}
                        className="bg-slate-50 dark:bg-[#0b1510] border border-slate-200 dark:border-emerald-900/60 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-600"
                      >
                        <option value="all">All Categories</option>
                        <option value="with_products">With Active Products</option>
                        <option value="empty">Empty (0 Products)</option>
                      </select>
                    </div>

                    <div className="text-slate-400 dark:text-slate-500 font-mono text-xs">
                      Showing {formatNumber(filteredCategories.length, language)} of {formatNumber(categories.length, language)} categories
                    </div>
                  </div>
                </div>

                {categoriesError && (
                  <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-red-900 dark:text-red-300">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
                      <span><strong>Error loading categories:</strong> {categoriesError}</span>
                    </div>
                    <button
                      onClick={checkConnectionAndLoad}
                      className="px-3 py-1 bg-white dark:bg-[#101c16] border border-red-200 dark:border-red-800/70 hover:bg-red-100 rounded-lg font-semibold text-red-800 dark:text-red-300"
                    >
                      Retry
                    </button>
                  </div>
                )}

                <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 dark:bg-[#0c1611] text-slate-500 dark:text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-100 dark:border-emerald-900/40">
                        <tr>
                          <th className="py-3 px-4">Category Name</th>
                          <th className="py-3 px-4">Slug</th>
                          <th className="py-3 px-4">Description</th>
                          <th className="py-3 px-4">Linked Batches</th>
                          <th className="py-3 px-4">Created Date</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/40">
                        {loadingData && categories.length === 0 ? (
                          [1, 2, 3, 4].map(idx => (
                            <tr key={idx} className="animate-pulse">
                              <td className="py-3.5 px-4"><div className="h-4 w-36 bg-slate-200 dark:bg-emerald-950/70 rounded" /></td>
                              <td className="py-3.5 px-4"><div className="h-3.5 w-28 bg-slate-100 dark:bg-[#13221a] rounded" /></td>
                              <td className="py-3.5 px-4"><div className="h-3.5 w-56 bg-slate-100 dark:bg-[#13221a] rounded" /></td>
                              <td className="py-3.5 px-4"><div className="h-5 w-20 bg-slate-100 dark:bg-[#13221a] rounded" /></td>
                              <td className="py-3.5 px-4"><div className="h-3.5 w-20 bg-slate-100 dark:bg-[#13221a] rounded" /></td>
                              <td className="py-3.5 px-4 text-right"><div className="h-6 w-16 bg-slate-100 dark:bg-[#13221a] rounded ml-auto" /></td>
                            </tr>
                          ))
                        ) : filteredCategories.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 px-4 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                              <Layers className="w-7 h-7 text-slate-300 dark:text-slate-600 mx-auto" />
                              <div className="font-semibold text-slate-700 dark:text-slate-200">
                                {categories.length === 0
                                  ? tr('No categories found', 'কোনো বিভাগ পাওয়া যায়নি')
                                  : tr('No categories match your filter', 'ফিল্টারের সাথে কোনো বিভাগ মেলেনি')}
                              </div>
                              <div className="flex items-center justify-center gap-2 pt-1">
                                {categories.length > 0 && (
                                  <button
                                    onClick={() => {
                                      setCategorySearch('');
                                      setCategoryUsageFilter('all');
                                    }}
                                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-emerald-900/60 text-slate-700 dark:text-slate-200 font-semibold hover:bg-slate-50 dark:hover:bg-[#13221a]"
                                  >
                                    Clear Filters
                                  </button>
                                )}
                                <button
                                  onClick={openCreateCategoryModal}
                                  className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold"
                                >
                                  Create Category
                                </button>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredCategories.map((c, i) => (
                            <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-[#13221a]/60 transition">
                              <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-slate-100">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                    {i % 5 === 0 && <Apple className="w-4 h-4" />}
                                    {i % 5 === 1 && <Wheat className="w-4 h-4" />}
                                    {i % 5 === 2 && <Milk className="w-4 h-4" />}
                                    {i % 5 === 3 && <Droplets className="w-4 h-4" />}
                                    {i % 5 === 4 && <Carrot className="w-4 h-4" />}
                                  </div>
                                  <span>{c.name}</span>
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-emerald-700 dark:text-emerald-400">{c.slug}</td>
                              <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 max-w-md truncate">
                                {c.description || <span className="text-slate-400 italic">No description</span>}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="font-mono font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#13221a] px-2 py-0.5 rounded">
                                  {formatNumber(c.skuCount, language)} product{c.skuCount === 1 ? '' : 's'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">{c.tempRange}</td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => openEditCategoryModal(c)}
                                    className="text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition"
                                    title="Edit Category"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeleteCategoryError(null);
                                      setDeleteCategoryTarget(c);
                                    }}
                                    className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-950/60 transition"
                                    title="Delete Category"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ================= VIEW 4: TRADE ORDERS ================= */}
            {activeView === 'orders' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tr('Trade Purchase Orders', 'বাণিজ্যিক পণ্য অর্ডার')}</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {tr('Verified produce orders with protected payment, delivery status, and instant invoices', 'নিরাপদ পেমেন্ট, ডেলিভারির তথ্য ও তাৎক্ষণিক ইনভয়েসসহ যাচাইকৃত পণ্যের অর্ডার')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleDownloadOrdersReportPdf}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-xs font-semibold text-emerald-800 dark:text-emerald-300 transition"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>{tr('Orders Report PDF', 'অর্ডার রিপোর্ট PDF')}</span>
                      </button>
                      <button
                        type="button"
                        onClick={checkConnectionAndLoad}
                        disabled={loadingData}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[#13221a] hover:bg-slate-50 dark:hover:bg-[#172a20] text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 ${loadingData ? 'animate-spin' : ''}`} />
                        <span>{tr('Refresh', 'রিফ্রেশ')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Status Tab Bar */}
                  <div className="pt-2 border-t border-slate-100 dark:border-emerald-900/40 flex flex-wrap gap-1.5 text-xs">
                    {(['all', 'placed', 'processing', 'shipped', 'delivered', 'cancelled'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setOrderStatusFilter(tab)}
                        className={`px-3 py-1.5 rounded-lg capitalize font-medium transition ${
                          orderStatusFilter === tab
                            ? 'bg-emerald-700 dark:bg-emerald-600 text-white font-semibold shadow-xs'
                            : 'bg-slate-50 dark:bg-[#0b1510] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13221a]'
                        }`}
                      >
                        {tab === 'all' ? 'All Orders' : tab}
                        <span className="ml-1.5 font-mono text-[11px] opacity-80">
                          ({formatNumber(tab === 'all' ? orders.length : orders.filter(o => o.orderStatus === tab).length, language)})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Orders Table */}
                <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 dark:bg-[#0c1611] text-slate-500 dark:text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-100 dark:border-emerald-900/40">
                        <tr>
                          <th className="py-3 px-4">Order ID</th>
                          <th className="py-3 px-4">Buyer Organization</th>
                          <th className="py-3 px-4">Produce Summary</th>
                          <th className="py-3 px-4">Order Total</th>
                          <th className="py-3 px-4">Payment Status</th>
                          <th className="py-3 px-4">Delivery Status</th>
                          <th className="py-3 px-4 text-right">Actions &amp; Invoice</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/40">
                        {filteredOrders.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-12 px-4 text-center text-slate-500 dark:text-slate-400">
                              {tr('No orders match the current filter.', 'বর্তমান ফিল্টারে কোনো অর্ডার পাওয়া যায়নি।')}
                            </td>
                          </tr>
                        ) : (
                          filteredOrders.map(o => (
                            <tr key={o.id} className="hover:bg-slate-50/60 dark:hover:bg-[#13221a]/60 transition">
                              <td className="py-3.5 px-4 font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                                {o.orderNumber}
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="font-semibold text-slate-900 dark:text-slate-100">{o.buyerName}</div>
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">{o.createdAt}</div>
                              </td>
                              <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                                <div>{o.productTitle}</div>
                                <div className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                                  {formatNumber(o.quantity, language)} {o.unitType} (Batch {o.batchNumber})
                                </div>
                              </td>
                              <td className="py-3.5 px-4 font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap tabular-nums">
                                {formatCurrency(o.totalAmount, language)}
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 whitespace-nowrap">
                                  {o.paymentStatus === 'escrow_held' ? 'protected' : o.paymentStatus.replace('_', ' ')}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-[#13221a] text-slate-700 dark:text-slate-300">
                                  {o.orderStatus}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  <button
                                    type="button"
                                    onClick={() => openInvoice(o)}
                                    title={tr('View Invoice', 'ইনভয়েস দেখুন')}
                                    className="inline-flex items-center gap-1 text-[11px] bg-slate-50 dark:bg-[#0b1510] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-emerald-900/60 px-2 py-1 rounded font-semibold hover:bg-emerald-50 dark:hover:bg-[#13221a] hover:text-emerald-700 dark:hover:text-emerald-300"
                                  >
                                    <FileText className="w-3 h-3" />
                                    <span>{tr('Invoice', 'ইনভয়েস')}</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadOrderPdf(o, 'invoice')}
                                    title={tr('Download Invoice PDF', 'ইনভয়েস PDF ডাউনলোড')}
                                    className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 px-2 py-1 rounded font-semibold hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
                                  >
                                    <FileDown className="w-3 h-3" />
                                    <span>PDF</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadOrderPdf(o, 'summary')}
                                    title={tr('Download Summary PDF', 'সারাংশ PDF ডাউনলোড')}
                                    className="inline-flex items-center gap-1 text-[11px] bg-white dark:bg-[#101c16] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-emerald-900/60 px-2 py-1 rounded font-semibold hover:bg-slate-50 dark:hover:bg-[#13221a]"
                                  >
                                    <Download className="w-3 h-3" />
                                    <span>{tr('Summary', 'সারাংশ')}</span>
                                  </button>
                                  {o.orderStatus === 'placed' && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={orderUpdatingId === o.id}
                                        onClick={() => handleUpdateOrderStatus(o, 'processing')}
                                        className="text-xs bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 px-2.5 py-1 rounded font-semibold hover:bg-emerald-100 disabled:opacity-50"
                                      >
                                        Confirm
                                      </button>
                                      <button
                                        type="button"
                                        disabled={orderUpdatingId === o.id}
                                        onClick={() => handleUpdateOrderStatus(o, 'cancelled')}
                                        className="text-xs bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900/70 px-2 py-1 rounded font-semibold hover:bg-red-100 disabled:opacity-50"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  )}
                                  {o.orderStatus === 'processing' && (
                                    <>
                                      <button
                                        type="button"
                                        disabled={orderUpdatingId === o.id}
                                        onClick={() => handleUpdateOrderStatus(o, 'shipped')}
                                        className="text-xs bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/70 px-2.5 py-1 rounded font-semibold hover:bg-sky-100 disabled:opacity-50"
                                      >
                                        Dispatch
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => openAssignShipmentModal(o)}
                                        className="text-xs bg-white dark:bg-[#13221a] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-emerald-900/60 px-2.5 py-1 rounded font-semibold hover:bg-slate-50 dark:hover:bg-[#172a20]"
                                      >
                                        Assign Carrier
                                      </button>
                                    </>
                                  )}
                                  {o.orderStatus === 'shipped' && (
                                    <button
                                      type="button"
                                      disabled={orderUpdatingId === o.id}
                                      onClick={() => handleUpdateOrderStatus(o, 'delivered')}
                                      className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 rounded font-semibold disabled:opacity-50"
                                    >
                                      Complete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ================= VIEW 5: COLD-CHAIN LOGISTICS & ROUTES ================= */}
            {activeView === 'logistics' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tr('Cold-Chain Logistics & Routes', 'কোল্ড-চেইন পরিবহন ও রুট')}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {tr('Live transport tracking and refrigerated temperature compliance across Bangladesh', 'সারা দেশে পরিবহন ও তাপমাত্রা সুরক্ষার সরাসরি অবস্থা')}
                    </p>
                  </div>
                  {orders.find(o => o.orderStatus === 'processing' || o.orderStatus === 'placed') && (
                    <button
                      type="button"
                      onClick={() => openAssignShipmentModal(orders.find(o => o.orderStatus === 'processing' || o.orderStatus === 'placed')!)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-xs transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{tr('Assign Shipment', 'চালান যুক্ত করুন')}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Panel: Active Fleet Shipments */}
                  <div className="lg:col-span-5 space-y-3">
                    {shipments.length === 0 ? (
                      <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                        {tr('No shipments recorded yet.', 'এখনও কোনো চালান যুক্ত করা হয়নি।')}
                      </div>
                    ) : (
                      shipments.map(s => (
                        <div
                          key={s.id}
                          onClick={() => setSelectedShipment(s)}
                          className={`p-4 rounded-xl border cursor-pointer transition ${
                            selectedShipment?.id === s.id
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/60 border-emerald-500 shadow-xs'
                              : 'bg-white dark:bg-[#101c16] border-slate-200 dark:border-emerald-900/50 hover:border-slate-300 dark:hover:border-emerald-700'
                          }`}
                        >
                          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-emerald-900/40">
                            <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300 text-xs">{s.trackingCode}</span>
                            <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/70">
                              {s.status.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="mt-2.5 space-y-1 text-xs">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">{s.product}</div>
                            <div className="text-slate-500 dark:text-slate-400 flex items-center justify-between">
                              <span>Driver: {s.driverName}</span>
                              <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{s.vehicleNumber}</span>
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-emerald-900/40 flex items-center justify-between text-xs">
                            <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">ETA: {s.eta}</span>
                            <span className="font-mono font-bold text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800/70 flex items-center gap-1">
                              <Thermometer className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                              {s.currentTempCelsius}°C
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Right Panel: Interactive Route Preview */}
                  <div className="lg:col-span-7 bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs space-y-5">
                    {!selectedShipment ? (
                      <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400">
                        {tr('Select a shipment to inspect route checkpoints.', 'রুট ও তাপমাত্রার তথ্য দেখতে একটি চালান নির্বাচন করুন।')}
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-emerald-900/40">
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                              Tracking Code: <span className="font-mono text-emerald-700 dark:text-emerald-400">{selectedShipment.trackingCode}</span>
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Carrier: {selectedShipment.supplierName}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedShipment.status !== 'in_transit' && selectedShipment.status !== 'delivered' && (
                              <button
                                onClick={() => handleUpdateShipment(selectedShipment.id, 'in_transit')}
                                className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 rounded-lg transition"
                              >
                                Mark In Transit
                              </button>
                            )}
                            {selectedShipment.status !== 'delivered' && (
                              <button
                                onClick={() => handleUpdateShipment(selectedShipment.id, 'delivered')}
                                className="text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-3 py-1.5 rounded-lg transition"
                              >
                                Confirm Delivery
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-50 dark:bg-[#0b1510] p-3 rounded-lg border border-slate-200 dark:border-emerald-900/50">
                          <div>
                            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Current Temp</span>
                            <span className="text-base font-bold font-mono text-sky-700 dark:text-sky-400">{selectedShipment.currentTempCelsius}°C</span>
                          </div>
                          <div>
                            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Safe Range</span>
                            <span className="text-base font-bold font-mono text-slate-700 dark:text-slate-200">{selectedShipment.targetTempCelsius}°C max</span>
                          </div>
                          <div>
                            <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Vehicle Plate</span>
                            <span className="text-base font-bold font-mono text-slate-700 dark:text-slate-200">{selectedShipment.vehicleNumber}</span>
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                            Route Checkpoints
                          </h4>
                          {selectedShipment.checkpoints.length === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">No route checkpoints recorded yet.</p>
                          ) : (
                            <div className="space-y-3">
                              {selectedShipment.checkpoints.map((cp, idx) => (
                                <div key={idx} className="flex items-start gap-3 text-xs bg-slate-50/70 dark:bg-[#0b1510] p-3 rounded-lg border border-slate-200/70 dark:border-emerald-900/40">
                                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-1 shrink-0" />
                                  <div className="space-y-0.5">
                                    <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                      <span>{cp.location}</span>
                                      <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px] font-normal">{cp.time}</span>
                                    </div>
                                    <div className="text-slate-500 dark:text-slate-400">{cp.note}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ================= VIEW 5B: REGIONAL WAREHOUSES CRUD ================= */}
            {activeView === 'warehouses' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tr('Regional Cold-Storage Warehouses', 'আঞ্চলিক হিমাগার ও গুদাম')}</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {tr('Manage regional agricultural storage hubs, capacity utilization, and thermal ranges', 'সারা দেশের হিমাগার, ধারণক্ষমতা ও তাপমাত্রা ব্যবস্থাপনা করুন')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={openCreateWarehouseModal}
                      className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition shadow-xs self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{tr('Add Warehouse Hub', 'নতুন হিমাগার যোগ')}</span>
                    </button>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-emerald-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={warehouseSearch}
                        onChange={e => setWarehouseSearch(e.target.value)}
                        placeholder={tr('Search hub code, city, or manager...', 'গুদামের নাম, কোড বা জেলা খুঁজুন...')}
                        className="bg-slate-50 dark:bg-[#0b1510] border border-slate-200 dark:border-emerald-900/60 text-xs text-slate-900 dark:text-slate-100 rounded-lg pl-8 pr-3 py-1.5 w-64 focus:outline-none focus:border-emerald-600 focus:bg-white dark:focus:bg-[#0e1913]"
                      />
                    </div>
                    <span className="font-mono text-slate-400 dark:text-slate-500">{formatNumber(filteredWarehouses.length, language)} hubs</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredWarehouses.map(wh => {
                    const pct = Math.min(100, Math.round((wh.occupiedTons / Math.max(1, wh.capacityTons)) * 100));
                    return (
                      <div key={wh.id} className="bg-white dark:bg-[#101c16] border border-slate-200/90 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="font-mono text-[11px] font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200 dark:border-emerald-800/70 px-2 py-0.5 rounded">
                              {wh.code}
                            </span>
                            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mt-2">{wh.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                              <span className="truncate">{wh.address}</span>
                            </p>
                          </div>
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                            wh.status === 'operational'
                              ? 'bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70'
                              : wh.status === 'near_capacity'
                              ? 'bg-amber-50 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/70'
                              : 'bg-slate-100 dark:bg-[#13221a] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-emerald-900/50'
                          }`}>
                            {wh.status.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
                            <span>{tr('Occupancy', 'ব্যবহৃত ধারণক্ষমতা')}</span>
                            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatNumber(wh.occupiedTons, language)} / {formatNumber(wh.capacityTons, language)} t ({formatNumber(pct, language)}%)</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-[#13221a] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct > 80 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-emerald-900/40 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-mono text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800/70">
                            {wh.tempRangeCelsius}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditWarehouseModal(wh)}
                              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded"
                              title="Edit warehouse"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteWarehouse(wh.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded"
                              title="Delete warehouse"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ================= VIEW 6: MEMBER DIRECTORY, FARMERS & BUYERS ================= */}
            {(activeView === 'users' || activeView === 'farmers' || activeView === 'buyers') && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        {activeView === 'farmers'
                          ? tr('Verified Farmers Directory', 'যাচাইকৃত কৃষক তালিকা')
                          : activeView === 'buyers'
                          ? tr('Verified Buyers Directory', 'যাচাইকৃত ক্রেতা তালিকা')
                          : tr('Member Directory & Verification', 'সদস্য তালিকা ও যাচাইকরণ')}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {activeView === 'farmers'
                          ? tr('Manage registered Bangladeshi producers, cooperatives, and verification approvals', 'নিবন্ধিত কৃষক ও সমবায়গুলোর তথ্য ও যাচাইকরণ পরিচালনা করুন')
                          : activeView === 'buyers'
                          ? tr('Manage wholesale buyers, retail partners, and purchase organizations', 'পাইকারি ক্রেতা ও বাণিজ্যিক প্রতিষ্ঠানের অ্যাকাউন্ট পরিচালনা করুন')
                          : tr('Verify accounts for Farmers, Transport Suppliers, Buyers, and Network Admins', 'কৃষক, পরিবহন পার্টনার, ক্রেতা ও অ্যাডমিন অ্যাকাউন্ট পরিচালনা করুন')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openCreateUserModal(activeView === 'buyers' ? 'buyer' : 'farmer')}
                      className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-xs px-3.5 py-2 rounded-lg transition shadow-xs self-start sm:self-auto"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>
                        {activeView === 'farmers'
                          ? tr('Add Farmer', 'নতুন কৃষক যোগ')
                          : activeView === 'buyers'
                          ? tr('Add Buyer', 'নতুন ক্রেতা যোগ')
                          : tr('Add Member', 'নতুন সদস্য যোগ')}
                      </span>
                    </button>
                  </div>

                  {/* Role Tabs & Search */}
                  <div className="pt-2 border-t border-slate-100 dark:border-emerald-900/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                    {activeView === 'users' ? (
                      <div className="flex flex-wrap gap-1.5">
                        {(['all', 'farmer', 'supplier', 'buyer', 'admin'] as const).map(role => (
                          <button
                            key={role}
                            onClick={() => setUserRoleFilter(role)}
                            className={`px-3 py-1.5 rounded-lg capitalize font-medium transition ${
                              userRoleFilter === role
                                ? 'bg-emerald-700 dark:bg-emerald-600 text-white font-semibold shadow-xs'
                                : 'bg-slate-50 dark:bg-[#0b1510] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#13221a]'
                            }`}
                          >
                            {role === 'all' ? 'All Roles' : `${role}s`}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-500 dark:text-slate-400 font-semibold">
                        {tr('Showing', 'প্রদর্শিত হচ্ছে')} <span className="font-mono text-slate-900 dark:text-slate-100">{formatNumber(filteredUsers.length, language)}</span>{' '}
                        {activeView === 'farmers' ? tr('registered farmers', 'জন কৃষক') : tr('registered buyers', 'জন ক্রেতা')}
                      </div>
                    )}

                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        placeholder="Search name, email, or org..."
                        className="bg-slate-50 dark:bg-[#0b1510] border border-slate-200 dark:border-emerald-900/60 text-xs text-slate-900 dark:text-slate-100 rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-emerald-600 focus:bg-white dark:focus:bg-[#0e1913]"
                      />
                    </div>
                  </div>
                </div>

                {/* Directory Table */}
                <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 dark:bg-[#0c1611] text-slate-500 dark:text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-100 dark:border-emerald-900/40">
                        <tr>
                          <th className="py-3 px-4">Member</th>
                          <th className="py-3 px-4">Role</th>
                          <th className="py-3 px-4">Organization / Farm</th>
                          <th className="py-3 px-4">Registration / NID</th>
                          <th className="py-3 px-4">Verification Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/40">
                        {filteredUsers.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 px-4 text-center text-slate-500 dark:text-slate-400">
                              {tr('No members found matching your filter.', 'কোনো সদস্য পাওয়া যায়নি।')}
                            </td>
                          </tr>
                        ) : (
                          filteredUsers.map(u => (
                            <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-[#13221a]/60 transition">
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold flex items-center justify-center text-xs shrink-0">
                                    {u.full_name.charAt(0)}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-slate-900 dark:text-slate-100">{u.full_name}</div>
                                    <div className="text-[11px] text-slate-400 dark:text-slate-500">{u.email}</div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-[#13221a] text-slate-700 dark:text-slate-300">
                                  {u.role}
                                </span>
                              </td>

                              <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                                {u.business_name || 'Individual Member'}
                              </td>

                              <td className="py-3.5 px-4 font-mono text-slate-500 dark:text-slate-400">
                                {u.tax_or_nid_no || 'PENDING'}
                              </td>

                              <td className="py-3.5 px-4">
                                {u.is_verified ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/70 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/70">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                                    Verified Member
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/70 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/70">
                                    <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                    Pending Review
                                  </span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    onClick={() => handleToggleVerification(u.id, u.is_verified)}
                                    className={`text-xs px-2.5 py-1 rounded font-semibold transition ${
                                      u.is_verified
                                        ? 'bg-slate-100 dark:bg-[#13221a] hover:bg-slate-200 dark:hover:bg-[#182d22] text-slate-600 dark:text-slate-300'
                                        : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                    }`}
                                  >
                                    {u.is_verified ? 'Suspend' : 'Approve'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openEditUserModal(u)}
                                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded"
                                    title="Edit member"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  {u.id !== currentUser?.id && (
                                    <button
                                      type="button"
                                      onClick={() => setDeleteUserTarget(u)}
                                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/60 rounded"
                                      title="Delete member"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ================= VIEW 7: TRADE REPORTS & CSV/PDF EXPORT ================= */}
            {activeView === 'reports' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tr('Agricultural Trade Reports & Analytics', 'বাণিজ্য রিপোর্ট ও বিশ্লেষণ')}</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {tr('Export live CSV and branded PDF summaries for harvest inventory, purchase orders, cold-chain shipments, and network members', 'পণ্য, অর্ডার, পরিবহন ও সদস্যদের পূর্ণাঙ্গ CSV ও PDF রিপোর্ট ডাউনলোড করুন')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadOrdersReportPdf}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-xs transition"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span>{tr('Export Orders Report PDF', 'অর্ডার রিপোর্ট PDF')}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 p-5 rounded-xl shadow-2xs">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{tr('Total Inventory Value', 'মোট মজুদের মূল্য')}</div>
                    <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1.5 tabular-nums">
                      {formatCurrency(products.reduce((s, p) => s + p.unitPrice * p.quantityAvailable, 0), language)}
                    </div>
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">{formatNumber(products.length, language)} {tr('harvest lots', 'টি ব্যাচ')}</div>
                  </div>
                  <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 p-5 rounded-xl shadow-2xs">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{tr('Order Fulfillment Rate', 'অর্ডার সম্পন্ন হার')}</div>
                    <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1.5">
                      {orders.length > 0
                        ? `${formatNumber(Math.round((orders.filter(o => o.orderStatus === 'delivered').length / orders.length) * 100), language)}%`
                        : `${formatNumber(0, language)}%`}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {formatNumber(orders.filter(o => o.orderStatus === 'delivered').length, language)} of {formatNumber(orders.length, language)} orders
                    </div>
                  </div>
                  <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 p-5 rounded-xl shadow-2xs">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{tr('Low / Out of Stock Lots', 'স্বল্প মজুদ ব্যাচ')}</div>
                    <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-1.5">
                      {formatNumber(products.filter(p => p.status === 'low_stock' || p.status === 'out_of_stock').length, language)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{tr('Needs restock attention', 'পুনরায় মজুদ প্রয়োজন')}</div>
                  </div>
                  <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 p-5 rounded-xl shadow-2xs">
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{tr('Regional Storage Capacity', 'হিমাগার ধারণক্ষমতা')}</div>
                    <div className="text-2xl font-bold font-mono text-emerald-800 dark:text-emerald-300 mt-1.5">
                      {formatNumber(warehouses.reduce((s, w) => s + w.capacityTons, 0), language)} t
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      {formatNumber(warehouses.reduce((s, w) => s + w.occupiedTons, 0), language)} t occupied
                    </div>
                  </div>
                </div>

                {/* Chart.js Trade & Inventory Analytics */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs space-y-3">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {tr('Order Fulfillment & Revenue Breakdown (Chart.js)', 'অর্ডার ও আয় বিশ্লেষণ')}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {tr('Live order volume and GMV across workflow stages', 'অর্ডার ধাপ অনুযায়ী মোট মূল্য ও সংখ্যা')}
                      </p>
                    </div>
                    <ReportsTradeBarChart orders={orders} />
                  </div>

                  <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs space-y-3">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {tr('Stock Units & Value by Category (Chart.js)', 'বিভাগ অনুযায়ী মজুদ ও মূল্য')}
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {tr('Real-time available quantity and catalog value', 'সক্রিয় ব্যাচের মোট পরিমাণ ও বাজারমূল্য')}
                      </p>
                    </div>
                    <CategoryStockBarChart products={products} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{tr('Harvest Inventory Report', 'ফসল মজুদ রিপোর্ট')}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatNumber(products.length, language)} batches with prices, stock &amp; cold storage targets</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv(
                          'agrihub-inventory.csv',
                          ['ID', 'Batch Code', 'Title', 'Category', 'Farmer', 'Price (BDT)', 'Unit', 'Qty', 'Temp C', 'Status'],
                          products.map(p => [p.id, p.batchNumber, p.title, p.category, p.farmerName, p.unitPrice, p.unitType, p.quantityAvailable, p.storageTempCelsius, p.status])
                        )
                      }
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </button>
                  </div>

                  <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{tr('Wholesale Orders Report', 'অর্ডার রিপোর্ট')}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatNumber(orders.length, language)} purchase orders with totals &amp; payment state</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleDownloadOrdersReportPdf}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 font-semibold text-xs rounded-lg"
                      >
                        <FileDown className="w-3.5 h-3.5" />
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          downloadCsv(
                            'agrihub-orders.csv',
                            ['Order Number', 'Buyer', 'Product', 'Qty', 'Total (BDT)', 'Payment', 'Status', 'Created'],
                            orders.map(o => [o.orderNumber, o.buyerName, o.productTitle, o.quantity, o.totalAmount, o.paymentStatus, o.orderStatus, o.createdAt])
                          )
                        }
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>CSV</span>
                      </button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{tr('Cold-Chain Logistics Report', 'পরিবহন ও লজিস্টিকস রিপোর্ট')}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatNumber(shipments.length, language)} refrigerated transport manifests &amp; temperatures</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv(
                          'agrihub-shipments.csv',
                          ['Tracking Code', 'Order', 'Carrier', 'Driver', 'Vehicle', 'Origin', 'Destination', 'Temp C', 'Status'],
                          shipments.map(s => [s.trackingCode, s.orderNumber, s.supplierName, s.driverName, s.vehicleNumber, s.originHub, s.destinationHub, s.currentTempCelsius, s.status])
                        )
                      }
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </button>
                  </div>

                  <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{tr('Network Members Report', 'সদস্য তালিকা রিপোর্ট')}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{formatNumber(users.length, language)} verified farmers, carriers, buyers, and admins</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        downloadCsv(
                          'agrihub-members.csv',
                          ['ID', 'Name', 'Email', 'Role', 'Organization', 'Verified', 'Created'],
                          users.map(u => [u.id, u.full_name, u.email, u.role, u.business_name, u.is_verified ? 'Yes' : 'No', u.created_at])
                        )
                      }
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ================= VIEW 8: ADMIN SETTINGS ================= */}
            {activeView === 'settings' && (
              <div className="space-y-6">
                <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{tr('Platform & Cold-Chain Settings', 'কনসোল ও কোল্ড-চেইন সেটিংস')}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {tr('Configure alert thresholds, language preference, security, and local service endpoint', 'সতর্কতার তাপমাত্রা সীমা, ভাষা এবং অ্যাকাউন্ট নিরাপত্তা পরিচালনা করুন')}
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-6 shadow-2xs space-y-4 text-xs">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{tr('Regional & Cold-Chain Controls', 'আঞ্চলিক ও তাপমাত্রা নিয়ন্ত্রণ')}</h3>

                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5">{tr('Interface Language', 'ভাষা নির্বাচন')}</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setLanguage('en')}
                          className={`px-4 py-2 rounded-lg font-bold border ${language === 'en' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-slate-50 dark:bg-[#0b1510] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-emerald-900/60'}`}
                        >
                          English (Montserrat)
                        </button>
                        <button
                          type="button"
                          onClick={() => setLanguage('bn')}
                          className={`px-4 py-2 rounded-lg font-bold border ${language === 'bn' ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-slate-50 dark:bg-[#0b1510] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-emerald-900/60'}`}
                        >
                          বাংলা (Hind Siliguri)
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                        {tr('Cold-Chain Alert Threshold (°C)', 'কোল্ড-চেইন সতর্কতা তাপমাত্রা (°C)')}
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        value={tempAlertThreshold}
                        onChange={e => setTempAlertThreshold(e.target.value)}
                        className="w-full bg-slate-50 dark:bg-[#0b1510] border border-slate-200 dark:border-emerald-900/60 rounded-lg px-3 py-2 font-mono text-slate-900 dark:text-slate-100"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                        {tr('Backend API Base URL', 'ব্যাকএন্ড এপিআই বেস ইউআরএল')}
                      </label>
                      <input
                        type="url"
                        value={apiEndpointOverride}
                        onChange={e => setApiEndpointOverride(e.target.value)}
                        placeholder="https://your-php-api.onrender.com/api"
                        className="w-full bg-slate-50 dark:bg-[#0b1510] border border-slate-200 dark:border-emerald-900/60 rounded-lg px-3 py-2 font-mono text-slate-900 dark:text-slate-100"
                      />
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {tr(
                          'Leave empty to work locally without a remote server, or point to your deployed PHP API.',
                          'সার্ভার ছাড়া লোকালভাবে ব্যবহার করতে খালি রাখুন অথবা আপনার পিএইচপি এপিআই ইউআরএল দিন।'
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          localStorage.setItem('agrihub_temp_threshold', tempAlertThreshold);
                          setApiUrl(apiEndpointOverride.trim());
                          showToast(tr('Platform settings saved.', 'সেটিংস সংরক্ষিত হয়েছে।'));
                          checkConnectionAndLoad();
                        }}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold rounded-lg transition"
                      >
                        {tr('Save Settings', 'সংরক্ষণ করুন')}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const defaultUrl = getDefaultApiBaseUrl();
                          setApiEndpointOverride(defaultUrl);
                          setApiUrl(defaultUrl);
                          showToast(tr('API URL reset to environment default.', 'এপিআই ইউআরএল ডিফল্টে রিসেট হয়েছে।'), 'info');
                          checkConnectionAndLoad();
                        }}
                        className="px-3.5 py-2 border border-slate-200 dark:border-emerald-900/60 bg-slate-50 dark:bg-[#0b1510] hover:bg-slate-100 dark:hover:bg-[#13221a] text-slate-700 dark:text-slate-200 font-semibold rounded-lg transition"
                      >
                        {tr('Reset Default', 'ডিফল্ট রিসেট')}
                      </button>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-6 shadow-2xs space-y-4 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{tr('Administrator Profile & Security', 'অ্যাডমিন প্রোফাইল ও নিরাপত্তা')}</h3>
                      <button
                        type="button"
                        onClick={openProfileEditModal}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-semibold transition"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>{tr('Edit Profile', 'প্রোফাইল সম্পাদনা')}</span>
                      </button>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-[#0b1510] border border-slate-200 dark:border-emerald-900/60 rounded-xl space-y-1.5">
                      <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">{currentUser?.full_name || 'Administrator'}</div>
                      <div className="text-slate-500 dark:text-slate-400">{currentUser?.email}</div>
                      {currentUser?.phone && (
                        <div className="text-slate-600 dark:text-slate-300 font-mono">{currentUser.phone}</div>
                      )}
                      {currentUser?.business_name && (
                        <div className="text-slate-600 dark:text-slate-300">{currentUser.business_name}</div>
                      )}
                      {currentUser?.address && (
                        <div className="text-slate-500 dark:text-slate-400">{currentUser.address}</div>
                      )}
                      <div className="inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 mt-1">
                        {currentUser?.role || 'admin'}
                      </div>
                    </div>
                    <Link
                      to="/forgot-password"
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/70 font-bold rounded-lg transition"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>{tr('Update Administrator Password', 'অ্যাডমিন পাসওয়ার্ড পরিবর্তন করুন')}</span>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* ================= VIEW 8B: /docs PITCH DECK & TECHNICAL DOCS CMS ================= */}
            {activeView === 'docs' && (
              <Suspense
                fallback={
                  <div className="p-6 text-xs font-semibold text-slate-500">
                    Loading Docs Studio...
                  </div>
                }
              >
                <DocsProvider>
                  <DocsAdminWorkspace />
                </DocsProvider>
              </Suspense>
            )}

            {/* ================= VIEW 9: NETWORK ACTIVITY HISTORY ================= */}
            {activeView === 'audit' && (
              <div className="space-y-4">
                <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl p-5 shadow-2xs">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {tr('Network Activity History', 'নেটওয়ার্ক কার্যক্রম ইতিহাস')}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {tr('Recent account, inventory, and order updates across the platform', 'সকল সদস্য, পণ্য ও অর্ডার কার্যক্রমের ইতিহাস')}
                  </p>
                </div>

                <div className="bg-white dark:bg-[#101c16] border border-slate-200/80 dark:border-emerald-900/50 rounded-xl shadow-2xs overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/80 dark:bg-[#0c1611] text-slate-500 dark:text-slate-400 uppercase font-semibold text-[11px] border-b border-slate-100 dark:border-emerald-900/40">
                        <tr>
                          <th className="py-3 px-4">Date &amp; Time</th>
                          <th className="py-3 px-4">Activity</th>
                          <th className="py-3 px-4">Member</th>
                          <th className="py-3 px-4">Reference</th>
                          <th className="py-3 px-4 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-emerald-900/40 font-mono text-[11px]">
                        {auditLogs.map((log, idx) => (
                          <tr key={`audit-${log.id}-${idx}`} className="hover:bg-slate-50/60 dark:hover:bg-[#13221a]/60 transition">
                            <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">{log.created_at}</td>
                            <td className="py-3.5 px-4 font-bold text-emerald-800 dark:text-emerald-300">
                              <span className="bg-emerald-50 dark:bg-emerald-950/70 border border-emerald-200/70 dark:border-emerald-800/70 px-1.5 py-0.5 rounded">
                                {log.action.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-sans">
                              {log.actor} <span className="text-[10px] text-slate-400 dark:text-slate-500">({log.role})</span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-semibold">{log.target}</td>
                            <td className="py-3.5 px-4 text-right font-sans">
                              <button
                                onClick={() => setInspectAuditLog(log)}
                                className="text-xs text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 font-medium underline"
                              >
                                View Details
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </main>
        </div>
      </div>

      {/* ================= 3. SLIDE-OVER DRAWER: CREATE / EDIT PRODUCT ================= */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col justify-between animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {editingProduct ? tr('Edit Harvest Batch', 'ফসলের ব্যাচ সম্পাদনা') : tr('Register Harvest Batch', 'নতুন ফসলের ব্যাচ যোগ')}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {editingProduct
                    ? tr(`Updating ${editingProduct.batchNumber} inventory details`, `${editingProduct.batchNumber} এর তথ্য হালনাগাদ`)
                    : tr('Create a new produce batch record', 'নতুন ফসলের ব্যাচ নিবন্ধন করুন')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setEditingProduct(null);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Form Body */}
            <form onSubmit={handleSaveProduct} id="batchForm" className="p-6 overflow-y-auto space-y-4 text-xs">
              {formFeedback && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 rounded-lg">
                  {formFeedback.message}
                </div>
              )}

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Crop / Produce Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="e.g. Export-Quality Hass Avocados"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Category *</label>
                  <select
                    value={newCategoryId}
                    onChange={e => setNewCategoryId(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
                  >
                    <option value={0} disabled>Select category...</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Producer / Farmer *</label>
                  <select
                    value={newFarmerId}
                    onChange={e => setNewFarmerId(Number(e.target.value))}
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
                  >
                    <option value={0} disabled>Select farmer...</option>
                    {producerOptions.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.full_name} {u.business_name ? `(${u.business_name})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Batch Code *</label>
                  <input
                    type="text"
                    required
                    value={newBatchCode}
                    onChange={e => setNewBatchCode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-emerald-800 dark:text-emerald-400 font-semibold focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Status *</label>
                  <select
                    value={newStatus}
                    onChange={e => setNewStatus(e.target.value as ProductItem['status'])}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="active">Active</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Harvest Date</label>
                  <input
                    type="date"
                    value={newHarvestDate}
                    onChange={e => setNewHarvestDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={newExpiryDate}
                    onChange={e => setNewExpiryDate(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Quantity Available *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={newQty}
                    onChange={e => setNewQty(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Measurement Unit *</label>
                  <select
                    value={newUnitType}
                    onChange={e => setNewUnitType(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="kg">kg (kilogram)</option>
                    <option value="ton">ton (metric)</option>
                    <option value="bag">bag (50kg)</option>
                    <option value="crate">crate</option>
                    <option value="liter">liter</option>
                    <option value="box">box</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                    {tr('Wholesale Price / Unit (BDT) *', 'পাইকারি একক মূল্য (৳) *')}
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    required
                    value={newPrice}
                    onChange={e => setNewPrice(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Target Storage Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newTemp}
                    onChange={e => setNewTemp(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <ProductImageDropzone
                value={newImageUrl}
                onChange={setNewImageUrl}
                label={tr('Produce Batch Photo (Drag & Drop or Browse)', 'ফসলের ছবি আপলোড (ড্র্যাগ ও ড্রপ)')}
              />

              <div className="pt-2">
                <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newOrganic}
                    onChange={e => setNewOrganic(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-600 text-emerald-700 focus:ring-emerald-600"
                  />
                  <span>Certified Organic Harvest</span>
                </label>
              </div>
            </form>

            {/* Drawer Footer Actions */}
            <div className="p-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDrawerOpen(false);
                  setEditingProduct(null);
                }}
                className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="batchForm"
                disabled={drawerSubmitting}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg text-xs transition shadow-xs flex items-center gap-2 disabled:opacity-60"
              >
                {drawerSubmitting
                  ? 'Saving...'
                  : editingProduct
                  ? 'Update Product'
                  : 'Create Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CATEGORY CREATE / EDIT MODAL ================= */}
      {categoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                  {editingCategory ? 'Edit Category' : 'Create Category'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {editingCategory ? `Updating '${editingCategory.name}'` : 'Add a new produce taxonomy category'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCategoryModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {catFormError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{catFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveCategory} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Category Name *</label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={e => {
                    const val = e.target.value;
                    setCatName(val);
                    if (!catSlugTouched) {
                      setCatSlug(slugifyCategory(val));
                    }
                  }}
                  placeholder="e.g. Tropical Fruits"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Slug *</label>
                <input
                  type="text"
                  required
                  value={catSlug}
                  onChange={e => {
                    setCatSlugTouched(true);
                    setCatSlug(e.target.value);
                  }}
                  placeholder="e.g. tropical-fruits"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 font-mono text-emerald-800 dark:text-emerald-400 focus:outline-none focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Description</label>
                <textarea
                  rows={3}
                  value={catDescription}
                  onChange={e => setCatDescription(e.target.value)}
                  placeholder="Describe produce items and handling standards..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-800"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={catSubmitting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg transition disabled:opacity-60"
                >
                  {catSubmitting ? 'Saving...' : editingCategory ? 'Save Changes' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DELETE CATEGORY CONFIRMATION DIALOG ================= */}
      {deleteCategoryTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Delete Category</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Are you sure you want to delete <strong className="text-slate-900 dark:text-slate-100">{deleteCategoryTarget.name}</strong>{' '}
                  (<code className="font-mono">{deleteCategoryTarget.slug}</code>)? This action cannot be undone.
                </p>
              </div>
            </div>

            {deleteCategoryError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 rounded-lg text-xs">
                {deleteCategoryError}
              </div>
            )}

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeleteCategoryTarget(null)}
                disabled={deleteCategoryLoading}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                disabled={deleteCategoryLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-60"
              >
                {deleteCategoryLoading ? 'Deleting...' : 'Delete Category'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= DELETE PRODUCT CONFIRMATION DIALOG ================= */}
      {deleteProductTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Delete Harvest Batch</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                  Are you sure you want to delete <strong className="text-slate-900 dark:text-slate-100">{deleteProductTarget.title}</strong>{' '}
                  (<code className="font-mono text-emerald-700 dark:text-emerald-400">{deleteProductTarget.batchNumber}</code>)?
                </p>
              </div>
            </div>

            {deleteProductError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 rounded-lg text-xs">
                {deleteProductError}
              </div>
            )}

            <div className="pt-2 flex flex-wrap items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeleteProductTarget(null)}
                disabled={deleteProductLoading}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              {deleteProductHasOrders && (
                <button
                  type="button"
                  onClick={handleArchiveInsteadOfDelete}
                  disabled={deleteProductLoading}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition disabled:opacity-60"
                >
                  {deleteProductLoading ? 'Archiving...' : 'Archive Batch Instead'}
                </button>
              )}
              <button
                type="button"
                onClick={handleConfirmDeleteProduct}
                disabled={deleteProductLoading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition disabled:opacity-60"
              >
                {deleteProductLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 4. MODERN SPLIT-SCREEN LOGIN MODAL ================= */}
      {showLoginModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 animate-in zoom-in-95 duration-150">
            {/* Left 50%: Form */}
            <div className="p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center">
                      <Sprout className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-base">AgriHub</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLoginModal(false)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="mt-8">
                  <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">Welcome to AgriHub</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Bangladesh&apos;s Trusted Agricultural Trade Network</p>
                </div>

                {loginError && (
                  <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-800 dark:text-red-300 rounded-lg">
                    {loginError}
                  </div>
                )}

                <form onSubmit={handleLogin} className="mt-6 space-y-3.5 text-xs">
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Email Address</label>
                    <input
                      type="email"
                      required
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-800"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input type="checkbox" defaultChecked className="rounded border-slate-300 dark:border-slate-600 text-emerald-700" />
                      <span>Remember session</span>
                    </label>
                    <Link
                      to="/forgot-password"
                      onClick={() => setShowLoginModal(false)}
                      className="text-emerald-700 dark:text-emerald-400 font-semibold hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2.5 rounded-lg text-xs transition shadow-xs mt-2"
                  >
                    {loginLoading ? 'Signing in...' : 'Sign In to Portal'}
                  </button>
                </form>
              </div>

              {/* Quick Preset Test Chips */}
              <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 block mb-2 uppercase tracking-wider">
                  Quick Account Access (Password: Password123!)
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => { setLoginEmail('admin@agrihub.local'); setLoginPassword('Password123!'); }}
                    className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 text-left text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>Admin</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLoginEmail('farmer@agrihub.local'); setLoginPassword('Password123!'); }}
                    className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 text-left text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1.5"
                  >
                    <Sprout className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>Farmer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLoginEmail('supplier@agrihub.local'); setLoginPassword('Password123!'); }}
                    className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 text-left text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1.5"
                  >
                    <Truck className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
                    <span>Supplier</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLoginEmail('buyer@agrihub.local'); setLoginPassword('Password123!'); }}
                    className="p-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 text-left text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1.5"
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-sky-700 dark:text-sky-400" />
                    <span>Buyer</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right 50%: Brand Showcase Image */}
            <div className="hidden md:block relative bg-slate-900 overflow-hidden">
              <img
                src={coldchainShowcaseImg}
                alt="AgriHub Harvest Storage and Cold-Chain Transport"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover opacity-90"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />

              <div className="absolute bottom-8 left-8 right-8 p-5 rounded-xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-white/40 dark:border-slate-700/60 shadow-xl">
                <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Verified Trade Network</span>
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  Trusted Access Control
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  Manage harvests, trade orders, and cold-chain deliveries across Bangladesh.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Product Modal */}
      {inspectProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">{inspectProduct.title}</h3>
              <button
                type="button"
                onClick={() => setInspectProduct(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {inspectProduct.imageUrl && (
                <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 aspect-[16/9]">
                  <img
                    src={inspectProduct.imageUrl}
                    alt={inspectProduct.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/70 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Batch ID</span>
                  <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">{inspectProduct.batchNumber}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Category</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{inspectProduct.category}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Origin Location</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{inspectProduct.farmLocation}</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Required Temp</span>
                  <span className="font-mono font-bold text-sky-700 dark:text-sky-400">{inspectProduct.storageTempCelsius}°C</span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">{tr('Unit Price', 'একক মূল্য')}</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {formatCurrency(inspectProduct.unitPrice, language)} / {inspectProduct.unitType}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 dark:text-slate-500 block text-[11px]">{tr('Available Stock', 'মজুদ')}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                    {formatNumber(inspectProduct.quantityAvailable, language)} {inspectProduct.unitType}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 dark:text-slate-500 block text-[11px]">Producer / Farm</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{inspectProduct.farmerName}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setInspectProduct(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  handlePlaceWholesaleOrder(inspectProduct, 250);
                  setInspectProduct(null);
                }}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition shadow-xs"
              >
                {tr(
                  `Order 250 ${inspectProduct.unitType} (${formatCurrency(inspectProduct.unitPrice * 250, language)})`,
                  `২৫০ ${inspectProduct.unitType} অর্ডার (${formatCurrency(inspectProduct.unitPrice * 250, language)})`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inspect Activity Details Modal */}
      {inspectAuditLog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {inspectAuditLog.action.replace(/_/g, ' ')}
                </h3>
                <span className="text-xs text-slate-400 dark:text-slate-500">{inspectAuditLog.created_at}</span>
              </div>
              <button
                type="button"
                onClick={() => setInspectAuditLog(null)}
                aria-label="Close activity details"
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/70 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                <span>Member: <strong className="text-slate-900 dark:text-slate-100">{inspectAuditLog.actor}</strong></span>
                <span>Target: <strong className="text-emerald-800 dark:text-emerald-400 font-mono">{inspectAuditLog.target}</strong></span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-200/70 dark:divide-slate-700/70">
                {Object.entries(inspectAuditLog.details || {}).length === 0 ? (
                  <div className="p-4 text-center text-slate-500 dark:text-slate-400">No additional details recorded.</div>
                ) : (
                  Object.entries(inspectAuditLog.details || {}).map(([key, value]) => (
                    <div key={key} className="px-3.5 py-2.5 flex items-center justify-between gap-4">
                      <span className="text-slate-500 dark:text-slate-400 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 text-right break-all">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectAuditLog(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/75 flex">
          <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-full p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center">
                    <Sprout className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-slate-900 dark:text-slate-100">AgriHub</span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="mt-4 space-y-1 text-sm font-medium overflow-y-auto">
                {(
                  [
                    ['dashboard', 'Dashboard'],
                    ['orders', 'Orders'],
                    ['logistics', 'Logistics'],
                    ['warehouses', 'Warehouses'],
                    ['batches', 'Products'],
                    ['categories', 'Categories'],
                    ['farmers', 'Farmers'],
                    ['buyers', 'Buyers'],
                    ['users', 'All Users'],
                    ['reports', 'Reports'],
                    ['audit', 'Activity'],
                    ['settings', 'Settings']
                  ] as Array<[ActiveView, string]>
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => goToView(v)}
                    className={`w-full text-left px-3 py-2 rounded-lg capitalize ${
                      activeView === v
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </nav>
            </div>

            <div className="pt-3 border-t border-slate-100 space-y-2">
              <button
                type="button"
                onClick={() => { setShowLoginModal(true); setMobileMenuOpen(false); }}
                className="w-full py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-lg text-xs"
              >
                Sign In / Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MEMBER CREATE / EDIT MODAL ================= */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                {editingUser ? 'Edit Member Account' : 'Add New Network Member'}
              </h3>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {uFormError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 rounded-lg text-xs">{uFormError}</div>
            )}
            <form onSubmit={handleSaveUser} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={uFullName}
                  onChange={e => setUFullName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                />
              </div>
              {!editingUser && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Email *</label>
                    <input
                      type="email"
                      required
                      value={uEmail}
                      onChange={e => setUEmail(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Password *</label>
                    <input
                      type="password"
                      required
                      value={uPassword}
                      onChange={e => setUPassword(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Role *</label>
                  <select
                    value={uRole}
                    onChange={e => setURole(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="farmer">Farmer</option>
                    <option value="buyer">Buyer</option>
                    <option value="supplier">Transport Partner</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Phone</label>
                  <input
                    type="text"
                    value={uPhone}
                    onChange={e => setUPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Farm / Organization</label>
                  <input
                    type="text"
                    value={uBusinessName}
                    onChange={e => setUBusinessName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">NID / License No</label>
                  <input
                    type="text"
                    value={uTaxNid}
                    onChange={e => setUTaxNid(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Address / District</label>
                <input
                  type="text"
                  value={uAddress}
                  onChange={e => setUAddress(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <label className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={uVerified}
                  onChange={e => setUVerified(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-600 text-emerald-700"
                />
                <span>Verified Account</span>
              </label>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uSubmitting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold disabled:opacity-60"
                >
                  {uSubmitting ? 'Saving...' : editingUser ? 'Save Changes' : 'Create Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DELETE MEMBER DIALOG ================= */}
      {deleteUserTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">Remove Member Account</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Remove <strong className="text-slate-900 dark:text-slate-100">{deleteUserTarget.full_name}</strong> ({deleteUserTarget.email})? Members with linked orders or produce lots cannot be deleted.
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeleteUserTarget(null)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteUserLoading}
                onClick={handleConfirmDeleteUser}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold disabled:opacity-60"
              >
                {deleteUserLoading ? 'Removing...' : 'Remove Member'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= ASSIGN COLD-CHAIN SHIPMENT MODAL ================= */}
      {shipmentModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                Assign Cold-Chain Shipment ({shipmentModalOrder.orderNumber})
              </h3>
              <button
                type="button"
                onClick={() => setShipmentModalOrder(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateShipment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Origin Hub *</label>
                <input
                  type="text"
                  required
                  value={shipOriginHub}
                  onChange={e => setShipOriginHub(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Destination Hub *</label>
                <input
                  type="text"
                  required
                  value={shipDestHub}
                  onChange={e => setShipDestHub(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Vehicle Number</label>
                  <input
                    type="text"
                    value={shipVehicleNo}
                    onChange={e => setShipVehicleNo(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={shipTemp}
                    onChange={e => setShipTemp(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Driver Name</label>
                  <input
                    type="text"
                    value={shipDriverName}
                    onChange={e => setShipDriverName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Driver Phone</label>
                  <input
                    type="text"
                    value={shipDriverPhone}
                    onChange={e => setShipDriverPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShipmentModalOrder(null)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={shipSubmitting}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold disabled:opacity-60"
                >
                  {shipSubmitting ? 'Assigning...' : 'Assign Shipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= WAREHOUSE CREATE / EDIT MODAL ================= */}
      {warehouseModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                {editingWarehouse ? 'Edit Cold-Storage Hub' : 'Add Cold-Storage Hub'}
              </h3>
              <button
                type="button"
                onClick={() => setWarehouseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveWarehouse} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Hub Code *</label>
                  <input
                    type="text"
                    required
                    value={whCode}
                    onChange={e => setWhCode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Region *</label>
                  <input
                    type="text"
                    required
                    value={whRegion}
                    onChange={e => setWhRegion(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Warehouse Name *</label>
                <input
                  type="text"
                  required
                  value={whName}
                  onChange={e => setWhName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Address *</label>
                <input
                  type="text"
                  required
                  value={whAddress}
                  onChange={e => setWhAddress(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Capacity (t)</label>
                  <input
                    type="number"
                    value={whCapacity}
                    onChange={e => setWhCapacity(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Occupied (t)</label>
                  <input
                    type="number"
                    value={whOccupied}
                    onChange={e => setWhOccupied(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Temp Range</label>
                  <input
                    type="text"
                    value={whTempRange}
                    onChange={e => setWhTempRange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Hub Manager</label>
                  <input
                    type="text"
                    value={whManager}
                    onChange={e => setWhManager(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Status</label>
                  <select
                    value={whStatus}
                    onChange={e => setWhStatus(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                  >
                    <option value="operational">Operational</option>
                    <option value="near_capacity">Near Capacity</option>
                    <option value="maintenance">Maintenance</option>
                  </select>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setWarehouseModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold"
                >
                  Save Hub
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= ADMIN PROFILE EDIT MODAL ================= */}
      {profileModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 dark:bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                {tr('Edit Administrator Profile', 'অ্যাডমিন প্রোফাইল সম্পাদনা')}
              </h3>
              <button
                type="button"
                onClick={() => setProfileModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdminProfile} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {tr('Full Name *', 'পূর্ণ নাম *')}
                </label>
                <input
                  type="text"
                  required
                  value={profFullName}
                  onChange={(e) => setProfFullName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {tr('Email Address', 'ইমেইল')}
                </label>
                <input
                  type="email"
                  required
                  value={profEmail}
                  onChange={(e) => setProfEmail(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {tr('Phone', 'ফোন নম্বর')}
                  </label>
                  <input
                    type="text"
                    value={profPhone}
                    onChange={(e) => setProfPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {tr('Organization', 'প্রতিষ্ঠান')}
                  </label>
                  <input
                    type="text"
                    value={profBusiness}
                    onChange={(e) => setProfBusiness(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {tr('Hub / Office Address', 'ঠিকানা')}
                </label>
                <input
                  type="text"
                  value={profAddress}
                  onChange={(e) => setProfAddress(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-lg px-3 py-2 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  {tr('Cancel', 'বাতিল')}
                </button>
                <button
                  type="submit"
                  disabled={profSaving}
                  className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-semibold disabled:opacity-60"
                >
                  {profSaving ? tr('Saving...', 'সংরক্ষণ হচ্ছে...') : tr('Save Profile', 'প্রোফাইল সংরক্ষণ করুন')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
