import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import {
  addSyncLog,
  ensureOfflineDbSeeded,
  offlineDb,
  type OfflineCategory,
  type OfflineOrder,
  type OfflineProduct,
  type OfflineShipment,
  type OfflineUser,
  type OfflineWarehouse,
  type SyncConflictRecord,
  type SyncEntityType,
  type SyncLogEntry,
  type SyncOperationType,
  type SyncQueueItem
} from '../lib/offlineDb';
import {
  createDemoConflictSample,
  enqueueOfflineMutation,
  generateTempId,
  resolveSyncConflict,
  runSyncCycle,
  type SyncRunSummary
} from '../lib/syncService';

export type UiSyncStatus = 'online' | 'offline' | 'syncing' | 'synced';

interface OfflineSyncContextType {
  syncStatus: UiSyncStatus;
  isNavigatorOnline: boolean;
  isBackendReachable: boolean;
  isOnline: boolean;
  statusMessage: string;
  pendingCount: number;
  conflictCount: number;
  lastSyncedAt: string | null;
  queueItems: SyncQueueItem[];
  conflicts: SyncConflictRecord[];
  syncLogs: SyncLogEntry[];
  refreshSyncState: () => Promise<void>;
  triggerSync: (forceAttempt?: boolean) => Promise<SyncRunSummary>;
  recheckConnectivity: () => Promise<boolean>;
  queueAndSyncMutation: (params: {
    entityType: SyncEntityType;
    operation: SyncOperationType;
    entityId: number;
    entityLabel: string;
    payload: Record<string, any>;
    baseServerUpdatedAt?: string;
  }) => Promise<void>;
  saveProductOfflineFirst: (
    product: Omit<OfflineProduct, 'id' | 'syncStatus' | 'localUpdatedAt'> & { id?: number },
    operation: 'create' | 'update',
    apiPayload: Record<string, any>
  ) => Promise<OfflineProduct>;
  deleteProductOfflineFirst: (product: OfflineProduct) => Promise<void>;
  saveCategoryOfflineFirst: (
    category: Omit<OfflineCategory, 'id' | 'syncStatus' | 'localUpdatedAt'> & { id?: number },
    operation: 'create' | 'update',
    apiPayload: Record<string, any>
  ) => Promise<OfflineCategory>;
  deleteCategoryOfflineFirst: (category: OfflineCategory) => Promise<void>;
  saveUserOfflineFirst: (
    user: Omit<OfflineUser, 'id' | 'syncStatus' | 'localUpdatedAt'> & { id?: number },
    operation: 'create' | 'update',
    apiPayload: Record<string, any>
  ) => Promise<OfflineUser>;
  deleteUserOfflineFirst: (user: OfflineUser) => Promise<void>;
  saveOrderStatusOfflineFirst: (order: OfflineOrder, nextStatus: OfflineOrder['orderStatus']) => Promise<OfflineOrder>;
  saveShipmentOfflineFirst: (
    shipment: Omit<OfflineShipment, 'id' | 'syncStatus' | 'localUpdatedAt'> & { id?: number },
    operation: 'create' | 'update',
    apiPayload: Record<string, any>
  ) => Promise<OfflineShipment>;
  saveWarehouseOfflineFirst: (
    warehouse: Omit<OfflineWarehouse, 'id' | 'syncStatus' | 'localUpdatedAt'> & { id?: number },
    operation: 'create' | 'update'
  ) => Promise<OfflineWarehouse>;
  deleteWarehouseOfflineFirst: (warehouse: OfflineWarehouse) => Promise<void>;
  resolveConflict: (
    conflictId: number,
    resolution: 'local' | 'server' | 'merge',
    mergedData?: Record<string, any>
  ) => Promise<void>;
  simulateConflict: () => Promise<void>;
  clearCompletedQueue: () => Promise<void>;
}

const OfflineSyncContext = createContext<OfflineSyncContextType | undefined>(undefined);

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const network = useNetworkStatus(30000);
  const [isSyncing, setIsSyncing] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  const [conflicts, setConflicts] = useState<SyncConflictRecord[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const prevOnlineRef = useRef<boolean>(false);
  const justSyncedTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (justSyncedTimerRef.current) window.clearTimeout(justSyncedTimerRef.current);
    };
  }, []);

  const refreshSyncState = useCallback(async () => {
    await ensureOfflineDbSeeded();
    const [q, c, logs] = await Promise.all([
      offlineDb.syncQueue.orderBy('id').reverse().limit(100).toArray(),
      offlineDb.conflicts.where('status').equals('unresolved').toArray(),
      offlineDb.syncLogs.orderBy('id').reverse().limit(60).toArray()
    ]);
    setQueueItems(q);
    setConflicts(c);
    setSyncLogs(logs);
  }, []);

  useEffect(() => {
    refreshSyncState();
  }, [refreshSyncState]);

  const triggerSync = useCallback(
    async (forceAttempt = false): Promise<SyncRunSummary> => {
      setIsSyncing(true);
      try {
        const summary = await runSyncCycle(forceAttempt);
        if (summary.synced > 0) {
          setLastSyncedAt(new Date().toISOString());
          setJustSynced(true);
          if (justSyncedTimerRef.current) window.clearTimeout(justSyncedTimerRef.current);
          justSyncedTimerRef.current = window.setTimeout(() => setJustSynced(false), 5000);
        }
        await refreshSyncState();
        return summary;
      } finally {
        setIsSyncing(false);
      }
    },
    [refreshSyncState]
  );

  // Auto-sync whenever network/backend transitions from offline -> online
  useEffect(() => {
    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = network.isOnline;

    if (network.isOnline && !wasOnline) {
      addSyncLog({
        level: 'success',
        action: 'CONNECTIVITY_RESTORED',
        entityType: 'system',
        message: 'Backend connectivity detected. Running automatic queue synchronization...'
      }).then(() => {
        triggerSync(true);
      });
    }
  }, [network.isOnline, triggerSync]);

  const queueAndSyncMutation = useCallback(
    async (params: {
      entityType: SyncEntityType;
      operation: SyncOperationType;
      entityId: number;
      entityLabel: string;
      payload: Record<string, any>;
      baseServerUpdatedAt?: string;
    }) => {
      await enqueueOfflineMutation(params);
      await refreshSyncState();
      if (network.isOnline) {
        await triggerSync(true);
      }
    },
    [network.isOnline, refreshSyncState, triggerSync]
  );

  const saveProductOfflineFirst: OfflineSyncContextType['saveProductOfflineFirst'] = useCallback(
    async (product, operation, apiPayload) => {
      await ensureOfflineDbSeeded();
      const nowIso = new Date().toISOString();
      const targetId = operation === 'create' ? product.id ?? generateTempId() : Number(product.id);
      const record: OfflineProduct = {
        ...product,
        id: targetId,
        syncStatus: 'pending',
        localUpdatedAt: nowIso
      };
      await offlineDb.products.put(record);
      await queueAndSyncMutation({
        entityType: 'product',
        operation,
        entityId: targetId,
        entityLabel: record.title,
        payload: apiPayload,
        baseServerUpdatedAt: product.serverUpdatedAt
      });
      return record;
    },
    [queueAndSyncMutation]
  );

  const deleteProductOfflineFirst = useCallback(
    async (product: OfflineProduct) => {
      await ensureOfflineDbSeeded();
      await offlineDb.products.delete(product.id);
      await queueAndSyncMutation({
        entityType: 'product',
        operation: 'delete',
        entityId: product.id,
        entityLabel: product.title,
        payload: { id: product.id },
        baseServerUpdatedAt: product.serverUpdatedAt
      });
    },
    [queueAndSyncMutation]
  );

  const saveCategoryOfflineFirst: OfflineSyncContextType['saveCategoryOfflineFirst'] = useCallback(
    async (category, operation, apiPayload) => {
      await ensureOfflineDbSeeded();
      const nowIso = new Date().toISOString();
      const targetId = operation === 'create' ? category.id ?? generateTempId() : Number(category.id);
      const record: OfflineCategory = {
        ...category,
        id: targetId,
        syncStatus: 'pending',
        localUpdatedAt: nowIso
      };
      await offlineDb.categories.put(record);
      await queueAndSyncMutation({
        entityType: 'category',
        operation,
        entityId: targetId,
        entityLabel: record.name,
        payload: apiPayload,
        baseServerUpdatedAt: category.serverUpdatedAt
      });
      return record;
    },
    [queueAndSyncMutation]
  );

  const deleteCategoryOfflineFirst = useCallback(
    async (category: OfflineCategory) => {
      await ensureOfflineDbSeeded();
      await offlineDb.categories.delete(category.id);
      await queueAndSyncMutation({
        entityType: 'category',
        operation: 'delete',
        entityId: category.id,
        entityLabel: category.name,
        payload: { id: category.id },
        baseServerUpdatedAt: category.serverUpdatedAt
      });
    },
    [queueAndSyncMutation]
  );

  const saveUserOfflineFirst: OfflineSyncContextType['saveUserOfflineFirst'] = useCallback(
    async (user, operation, apiPayload) => {
      await ensureOfflineDbSeeded();
      const nowIso = new Date().toISOString();
      const targetId = operation === 'create' ? user.id ?? generateTempId() : Number(user.id);
      const record: OfflineUser = {
        ...user,
        id: targetId,
        syncStatus: 'pending',
        localUpdatedAt: nowIso
      };
      await offlineDb.users.put(record);
      await queueAndSyncMutation({
        entityType: 'user',
        operation,
        entityId: targetId,
        entityLabel: record.full_name,
        payload: apiPayload,
        baseServerUpdatedAt: user.serverUpdatedAt
      });
      return record;
    },
    [queueAndSyncMutation]
  );

  const deleteUserOfflineFirst = useCallback(
    async (user: OfflineUser) => {
      await ensureOfflineDbSeeded();
      await offlineDb.users.delete(user.id);
      await queueAndSyncMutation({
        entityType: 'user',
        operation: 'delete',
        entityId: user.id,
        entityLabel: user.full_name,
        payload: { id: user.id },
        baseServerUpdatedAt: user.serverUpdatedAt
      });
    },
    [queueAndSyncMutation]
  );

  const saveOrderStatusOfflineFirst: OfflineSyncContextType['saveOrderStatusOfflineFirst'] = useCallback(
    async (order, nextStatus) => {
      await ensureOfflineDbSeeded();
      const nowIso = new Date().toISOString();
      const updated: OfflineOrder = {
        ...order,
        orderStatus: nextStatus,
        paymentStatus:
          nextStatus === 'delivered'
            ? 'paid'
            : nextStatus === 'cancelled'
            ? 'refunded'
            : order.paymentStatus,
        syncStatus: 'pending',
        localUpdatedAt: nowIso
      };
      await offlineDb.orders.put(updated);
      await queueAndSyncMutation({
        entityType: 'order',
        operation: 'update',
        entityId: order.id,
        entityLabel: order.orderNumber,
        payload: { order_id: order.id, orderStatus: nextStatus, status: nextStatus },
        baseServerUpdatedAt: order.serverUpdatedAt
      });
      return updated;
    },
    [queueAndSyncMutation]
  );

  const saveShipmentOfflineFirst: OfflineSyncContextType['saveShipmentOfflineFirst'] = useCallback(
    async (shipment, operation, apiPayload) => {
      await ensureOfflineDbSeeded();
      const nowIso = new Date().toISOString();
      const targetId = operation === 'create' ? shipment.id ?? generateTempId() : Number(shipment.id);
      const record: OfflineShipment = {
        ...shipment,
        id: targetId,
        syncStatus: 'pending',
        localUpdatedAt: nowIso
      };
      await offlineDb.shipments.put(record);
      await queueAndSyncMutation({
        entityType: 'shipment',
        operation,
        entityId: targetId,
        entityLabel: record.trackingCode,
        payload: apiPayload,
        baseServerUpdatedAt: shipment.serverUpdatedAt
      });
      return record;
    },
    [queueAndSyncMutation]
  );

  const saveWarehouseOfflineFirst: OfflineSyncContextType['saveWarehouseOfflineFirst'] = useCallback(
    async (warehouse, operation) => {
      await ensureOfflineDbSeeded();
      const nowIso = new Date().toISOString();
      const targetId = operation === 'create' ? warehouse.id ?? generateTempId() : Number(warehouse.id);
      const record: OfflineWarehouse = {
        ...warehouse,
        id: targetId,
        syncStatus: 'synced',
        localUpdatedAt: nowIso,
        serverUpdatedAt: nowIso
      };
      await offlineDb.warehouses.put(record);
      await addSyncLog({
        level: 'success',
        action: `WAREHOUSE_${operation.toUpperCase()}`,
        entityType: 'warehouse',
        entityId: targetId,
        message: `Saved warehouse "${record.name}" (${record.code}) locally.`
      });
      await refreshSyncState();
      return record;
    },
    [refreshSyncState]
  );

  const deleteWarehouseOfflineFirst = useCallback(
    async (warehouse: OfflineWarehouse) => {
      await ensureOfflineDbSeeded();
      await offlineDb.warehouses.delete(warehouse.id);
      await addSyncLog({
        level: 'info',
        action: 'WAREHOUSE_DELETED',
        entityType: 'warehouse',
        entityId: warehouse.id,
        message: `Removed warehouse "${warehouse.name}" from local storage.`
      });
      await refreshSyncState();
    },
    [refreshSyncState]
  );

  const resolveConflict = useCallback(
    async (
      conflictId: number,
      resolution: 'local' | 'server' | 'merge',
      mergedData?: Record<string, any>
    ) => {
      await resolveSyncConflict(conflictId, resolution, mergedData);
      await refreshSyncState();
      if (network.isOnline && resolution !== 'server') {
        await triggerSync(true);
      }
    },
    [network.isOnline, refreshSyncState, triggerSync]
  );

  const simulateConflict = useCallback(async () => {
    await createDemoConflictSample();
    await refreshSyncState();
  }, [refreshSyncState]);

  const clearCompletedQueue = useCallback(async () => {
    const completedIds = await offlineDb.syncQueue
      .where('status')
      .equals('completed')
      .primaryKeys();
    if (completedIds.length > 0) {
      await offlineDb.syncQueue.bulkDelete(completedIds);
    }
    await refreshSyncState();
  }, [refreshSyncState]);

  const pendingCount = useMemo(
    () =>
      queueItems.filter(
        (item) => item.status === 'pending' || item.status === 'failed' || item.status === 'syncing'
      ).length,
    [queueItems]
  );
  const conflictCount = conflicts.length;

  const syncStatus: UiSyncStatus = isSyncing
    ? 'syncing'
    : !network.isOnline
    ? 'offline'
    : justSynced || (pendingCount === 0 && lastSyncedAt !== null)
    ? 'synced'
    : 'online';

  const contextValue = useMemo<OfflineSyncContextType>(
    () => ({
      syncStatus,
      isNavigatorOnline: network.isNavigatorOnline,
      isBackendReachable: network.isBackendReachable,
      isOnline: network.isOnline,
      statusMessage: network.statusMessage,
      pendingCount,
      conflictCount,
      lastSyncedAt,
      queueItems,
      conflicts,
      syncLogs,
      refreshSyncState,
      triggerSync,
      recheckConnectivity: network.recheckConnectivity,
      queueAndSyncMutation,
      saveProductOfflineFirst,
      deleteProductOfflineFirst,
      saveCategoryOfflineFirst,
      deleteCategoryOfflineFirst,
      saveUserOfflineFirst,
      deleteUserOfflineFirst,
      saveOrderStatusOfflineFirst,
      saveShipmentOfflineFirst,
      saveWarehouseOfflineFirst,
      deleteWarehouseOfflineFirst,
      resolveConflict,
      simulateConflict,
      clearCompletedQueue
    }),
    [
      syncStatus,
      network.isNavigatorOnline,
      network.isBackendReachable,
      network.isOnline,
      network.statusMessage,
      network.recheckConnectivity,
      pendingCount,
      conflictCount,
      lastSyncedAt,
      queueItems,
      conflicts,
      syncLogs,
      refreshSyncState,
      triggerSync,
      queueAndSyncMutation,
      saveProductOfflineFirst,
      deleteProductOfflineFirst,
      saveCategoryOfflineFirst,
      deleteCategoryOfflineFirst,
      saveUserOfflineFirst,
      deleteUserOfflineFirst,
      saveOrderStatusOfflineFirst,
      saveShipmentOfflineFirst,
      saveWarehouseOfflineFirst,
      deleteWarehouseOfflineFirst,
      resolveConflict,
      simulateConflict,
      clearCompletedQueue
    ]
  );

  return (
    <OfflineSyncContext.Provider value={contextValue}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error('useOfflineSync must be used within an OfflineSyncProvider');
  }
  return ctx;
}
