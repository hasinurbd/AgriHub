import Dexie, { type Table } from 'dexie';
import {
  INITIAL_CATEGORIES,
  INITIAL_LOGISTICS,
  INITIAL_ORDERS,
  INITIAL_PRODUCTS,
  INITIAL_USERS,
  INITIAL_WAREHOUSES,
  type CategoryItem,
  type LogisticsShipment,
  type OrderItem,
  type ProductItem,
  type UserItem,
  type WarehouseItem
} from '../mockData';
import type { DocsDocumentState } from '../types/docs';

export type SyncEntityType =
  | 'product'
  | 'category'
  | 'user'
  | 'order'
  | 'shipment'
  | 'warehouse';

export type SyncOperationType = 'create' | 'update' | 'delete';

export type RecordSyncStatus = 'synced' | 'pending' | 'conflict' | 'error';

export type QueueItemStatus = 'pending' | 'syncing' | 'completed' | 'failed' | 'conflict';

export interface SyncMetaFields {
  syncStatus: RecordSyncStatus;
  localUpdatedAt: string;
  serverUpdatedAt?: string;
  clientTempId?: string;
  isDeleted?: boolean;
}

export type OfflineProduct = ProductItem & SyncMetaFields;
export type OfflineCategory = CategoryItem & SyncMetaFields;
export type OfflineUser = UserItem & SyncMetaFields;
export type OfflineOrder = OrderItem & SyncMetaFields;
export type OfflineShipment = LogisticsShipment & SyncMetaFields;
export type OfflineWarehouse = WarehouseItem & SyncMetaFields;

export interface SyncQueueItem {
  id?: number;
  idempotencyKey: string;
  entityType: SyncEntityType;
  entityId: number;
  entityLabel: string;
  operation: SyncOperationType;
  payload: Record<string, any>;
  baseServerUpdatedAt?: string;
  status: QueueItemStatus;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncConflictRecord {
  id?: number;
  queueItemId: number;
  entityType: SyncEntityType;
  entityId: number;
  entityLabel: string;
  localData: Record<string, any>;
  serverData: Record<string, any>;
  localUpdatedAt: string;
  serverUpdatedAt: string;
  status: 'unresolved' | 'resolved';
  resolution?: 'local' | 'server' | 'merge';
  detectedAt: string;
  resolvedAt?: string;
}

export interface SyncLogEntry {
  id?: number;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error';
  action: string;
  entityType: SyncEntityType | 'system';
  entityId?: number;
  message: string;
  details?: Record<string, any>;
}

export class AgriHubOfflineDB extends Dexie {
  products!: Table<OfflineProduct, number>;
  categories!: Table<OfflineCategory, number>;
  users!: Table<OfflineUser, number>;
  orders!: Table<OfflineOrder, number>;
  shipments!: Table<OfflineShipment, number>;
  warehouses!: Table<OfflineWarehouse, number>;
  syncQueue!: Table<SyncQueueItem, number>;
  conflicts!: Table<SyncConflictRecord, number>;
  syncLogs!: Table<SyncLogEntry, number>;
  docsState!: Table<DocsDocumentState, string>;

  constructor() {
    super('agrihub_offline_v1');

    this.version(1).stores({
      products: 'id, category_id, farmer_id, batchNumber, status, syncStatus, localUpdatedAt',
      categories: 'id, slug, name, syncStatus, localUpdatedAt',
      users: 'id, email, role, syncStatus, localUpdatedAt',
      orders: 'id, orderNumber, orderStatus, paymentStatus, syncStatus, localUpdatedAt',
      shipments: 'id, trackingCode, orderNumber, status, syncStatus, localUpdatedAt',
      warehouses: 'id, code, region, status, syncStatus, localUpdatedAt',
      syncQueue: '++id, &idempotencyKey, entityType, entityId, operation, status, createdAt',
      conflicts: '++id, queueItemId, entityType, entityId, status, detectedAt',
      syncLogs: '++id, timestamp, level, action, entityType'
    });

    this.version(2).stores({
      products: 'id, category_id, farmer_id, batchNumber, status, syncStatus, localUpdatedAt',
      categories: 'id, slug, name, syncStatus, localUpdatedAt',
      users: 'id, email, role, syncStatus, localUpdatedAt',
      orders: 'id, orderNumber, orderStatus, paymentStatus, syncStatus, localUpdatedAt',
      shipments: 'id, trackingCode, orderNumber, status, syncStatus, localUpdatedAt',
      warehouses: 'id, code, region, status, syncStatus, localUpdatedAt',
      syncQueue: '++id, &idempotencyKey, entityType, entityId, operation, status, createdAt',
      conflicts: '++id, queueItemId, entityType, entityId, status, detectedAt',
      syncLogs: '++id, timestamp, level, action, entityType',
      docsState: 'id'
    });
  }
}

export const offlineDb = new AgriHubOfflineDB();

let seedingPromise: Promise<void> | null = null;

export async function ensureOfflineDbSeeded(): Promise<void> {
  if (seedingPromise) return seedingPromise;

  seedingPromise = (async () => {
    try {
      const [productCount, categoryCount, logCount] = await Promise.all([
        offlineDb.products.count(),
        offlineDb.categories.count(),
        offlineDb.syncLogs.count()
      ]);

      const nowIso = new Date().toISOString();

      if (categoryCount === 0) {
        await offlineDb.categories.bulkPut(
          INITIAL_CATEGORIES.map((c) => ({
            ...c,
            syncStatus: 'synced' as const,
            localUpdatedAt: nowIso,
            serverUpdatedAt: nowIso
          }))
        );
      }

      if (productCount === 0) {
        await offlineDb.products.bulkPut(
          INITIAL_PRODUCTS.map((p) => ({
            ...p,
            syncStatus: 'synced' as const,
            localUpdatedAt: nowIso,
            serverUpdatedAt: nowIso
          }))
        );
      }

      if ((await offlineDb.users.count()) === 0) {
        await offlineDb.users.bulkPut(
          INITIAL_USERS.map((u) => ({
            ...u,
            syncStatus: 'synced' as const,
            localUpdatedAt: nowIso,
            serverUpdatedAt: nowIso
          }))
        );
      }

      if ((await offlineDb.orders.count()) === 0) {
        await offlineDb.orders.bulkPut(
          INITIAL_ORDERS.map((o) => ({
            ...o,
            syncStatus: 'synced' as const,
            localUpdatedAt: nowIso,
            serverUpdatedAt: nowIso
          }))
        );
      }

      if ((await offlineDb.shipments.count()) === 0) {
        await offlineDb.shipments.bulkPut(
          INITIAL_LOGISTICS.map((s) => ({
            ...s,
            syncStatus: 'synced' as const,
            localUpdatedAt: nowIso,
            serverUpdatedAt: nowIso
          }))
        );
      }

      if ((await offlineDb.warehouses.count()) === 0) {
        await offlineDb.warehouses.bulkPut(
          INITIAL_WAREHOUSES.map((w) => ({
            ...w,
            syncStatus: 'synced' as const,
            localUpdatedAt: nowIso,
            serverUpdatedAt: nowIso
          }))
        );
      }

      if (logCount === 0) {
        const t1 = new Date(Date.now() - 1000 * 60 * 14).toISOString();
        const t2 = new Date(Date.now() - 1000 * 60 * 9).toISOString();
        const t3 = new Date(Date.now() - 1000 * 60 * 4).toISOString();

        await offlineDb.syncLogs.bulkAdd([
          {
            timestamp: t1,
            level: 'info',
            action: 'OFFLINE_DB_INITIALIZED',
            entityType: 'system',
            message: 'IndexedDB offline cache (agrihub_offline_v1) seeded with demo catalog, orders, and logistics.'
          },
          {
            timestamp: t2,
            level: 'success',
            action: 'SNAPSHOT_CACHED',
            entityType: 'product',
            message: `Cached ${INITIAL_PRODUCTS.length} produce lots and ${INITIAL_CATEGORIES.length} categories for offline access.`
          },
          {
            timestamp: t3,
            level: 'info',
            action: 'SYNC_READY',
            entityType: 'system',
            message: 'Offline mutation queue armed with idempotency keys & conflict detection.'
          }
        ]);
      }
    } catch (err) {
      console.error('Failed to seed AgriHub IndexedDB:', err);
    } finally {
      seedingPromise = null;
    }
  })();

  return seedingPromise;
}

export async function addSyncLog(entry: Omit<SyncLogEntry, 'id' | 'timestamp'>): Promise<void> {
  try {
    await offlineDb.syncLogs.add({
      ...entry,
      timestamp: new Date().toISOString()
    });

    // Keep most recent 250 logs in IndexedDB
    const total = await offlineDb.syncLogs.count();
    if (total > 250) {
      const oldest = await offlineDb.syncLogs.orderBy('id').limit(total - 250).primaryKeys();
      if (oldest.length > 0) {
        await offlineDb.syncLogs.bulkDelete(oldest);
      }
    }
  } catch (err) {
    console.warn('Unable to write sync log:', err);
  }
}
