import { AgriHubApi, ApiError, hasConfiguredBackend } from '../api';
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
  type SyncOperationType,
  type SyncQueueItem
} from './offlineDb';

let activeSyncPromise: Promise<SyncRunSummary> | null = null;

export interface SyncRunSummary {
  attempted: number;
  synced: number;
  failed: number;
  conflicts: number;
  skippedOffline: boolean;
  awaitingAuth?: boolean;
  message: string;
}

function createIdempotencyKey(entityType: SyncEntityType, operation: SyncOperationType, entityId: number): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `agrihub_${entityType}_${operation}_${entityId}_${Date.now()}_${rand}`;
}

let tempIdSeq = 0;

export function generateTempId(): number {
  // Negative IDs unambiguously identify records created offline prior to server assignment
  tempIdSeq = (tempIdSeq + 1) % 1000;
  return -(Math.floor((Date.now() % 1000000) * 1000) + tempIdSeq);
}

/**
 * Enqueue a local mutation into Dexie `syncQueue` with automatic deduplication & coalescing
 * so rapid offline edits never cause duplicate uploads.
 */
export async function enqueueOfflineMutation(params: {
  entityType: SyncEntityType;
  operation: SyncOperationType;
  entityId: number;
  entityLabel: string;
  payload: Record<string, any>;
  baseServerUpdatedAt?: string;
}): Promise<number | null> {
  await ensureOfflineDbSeeded();
  const nowIso = new Date().toISOString();

  const existingPending = await offlineDb.syncQueue
    .where('entityType')
    .equals(params.entityType)
    .filter((item) => item.entityId === params.entityId && (item.status === 'pending' || item.status === 'failed'))
    .toArray();

  // Coalesce pending operations for the same entity to prevent duplicate API uploads
  if (existingPending.length > 0) {
    const latest = existingPending[existingPending.length - 1];

    if (latest.operation === 'create' && params.operation === 'delete') {
      // Created & deleted offline before ever reaching the server -> cancel out cleanly
      await offlineDb.syncQueue.bulkDelete(existingPending.map((i) => i.id!).filter(Boolean));
      await addSyncLog({
        level: 'info',
        action: 'QUEUE_COALESCED_CANCEL',
        entityType: params.entityType,
        entityId: params.entityId,
        message: `Cancelled unsynced offline creation for "${params.entityLabel}" after local deletion.`
      });
      return null;
    }

    if (latest.operation === 'create' && params.operation === 'update') {
      await offlineDb.syncQueue.update(latest.id!, {
        entityLabel: params.entityLabel,
        payload: { ...latest.payload, ...params.payload },
        status: 'pending',
        updatedAt: nowIso
      });
      await addSyncLog({
        level: 'info',
        action: 'QUEUE_COALESCED_CREATE',
        entityType: params.entityType,
        entityId: params.entityId,
        message: `Merged offline update into pending CREATE for "${params.entityLabel}".`
      });
      return latest.id!;
    }

    if (latest.operation === 'update' && params.operation === 'update') {
      await offlineDb.syncQueue.update(latest.id!, {
        entityLabel: params.entityLabel,
        payload: { ...latest.payload, ...params.payload },
        status: 'pending',
        updatedAt: nowIso
      });
      await addSyncLog({
        level: 'info',
        action: 'QUEUE_COALESCED_UPDATE',
        entityType: params.entityType,
        entityId: params.entityId,
        message: `Merged consecutive offline updates for "${params.entityLabel}" into a single sync job.`
      });
      return latest.id!;
    }

    if (latest.operation === 'update' && params.operation === 'delete') {
      await offlineDb.syncQueue.bulkDelete(existingPending.map((i) => i.id!).filter(Boolean));
    }
  }

  const queueId = await offlineDb.syncQueue.add({
    idempotencyKey: createIdempotencyKey(params.entityType, params.operation, params.entityId),
    entityType: params.entityType,
    entityId: params.entityId,
    entityLabel: params.entityLabel,
    operation: params.operation,
    payload: params.payload,
    baseServerUpdatedAt: params.baseServerUpdatedAt,
    status: 'pending',
    retryCount: 0,
    createdAt: nowIso,
    updatedAt: nowIso
  });

  await addSyncLog({
    level: 'info',
    action: `QUEUED_${params.operation.toUpperCase()}`,
    entityType: params.entityType,
    entityId: params.entityId,
    message: `Saved locally & queued ${params.operation.toUpperCase()} for "${params.entityLabel}".`
  });

  return queueId;
}

async function markEntitySynced(
  entityType: SyncEntityType,
  localId: number,
  newServerId?: number
): Promise<void> {
  const nowIso = new Date().toISOString();

  if (entityType === 'product') {
    const existing = await offlineDb.products.get(localId);
    if (!existing) return;
    if (newServerId && newServerId !== localId) {
      await offlineDb.products.delete(localId);
      await offlineDb.products.put({
        ...existing,
        id: newServerId,
        syncStatus: 'synced',
        serverUpdatedAt: nowIso,
        localUpdatedAt: nowIso
      });
    } else {
      await offlineDb.products.update(localId, {
        syncStatus: 'synced',
        serverUpdatedAt: nowIso
      });
    }
  } else if (entityType === 'category') {
    const existing = await offlineDb.categories.get(localId);
    if (!existing) return;
    if (newServerId && newServerId !== localId) {
      await offlineDb.categories.delete(localId);
      await offlineDb.categories.put({
        ...existing,
        id: newServerId,
        syncStatus: 'synced',
        serverUpdatedAt: nowIso,
        localUpdatedAt: nowIso
      });
    } else {
      await offlineDb.categories.update(localId, {
        syncStatus: 'synced',
        serverUpdatedAt: nowIso
      });
    }
  } else if (entityType === 'user') {
    const existing = await offlineDb.users.get(localId);
    if (!existing) return;
    if (newServerId && newServerId !== localId) {
      await offlineDb.users.delete(localId);
      await offlineDb.users.put({
        ...existing,
        id: newServerId,
        syncStatus: 'synced',
        serverUpdatedAt: nowIso,
        localUpdatedAt: nowIso
      });
    } else {
      await offlineDb.users.update(localId, {
        syncStatus: 'synced',
        serverUpdatedAt: nowIso
      });
    }
  } else if (entityType === 'order') {
    await offlineDb.orders.update(localId, { syncStatus: 'synced', serverUpdatedAt: nowIso });
  } else if (entityType === 'shipment') {
    await offlineDb.shipments.update(localId, { syncStatus: 'synced', serverUpdatedAt: nowIso });
  } else if (entityType === 'warehouse') {
    await offlineDb.warehouses.update(localId, { syncStatus: 'synced', serverUpdatedAt: nowIso });
  }
}

async function checkForUpdateConflict(item: SyncQueueItem): Promise<{
  hasConflict: boolean;
  serverData?: Record<string, any>;
  serverUpdatedAt?: string;
}> {
  // Only check updates on existing server records (positive IDs)
  if (item.operation !== 'update' || item.entityId <= 0 || !item.baseServerUpdatedAt) {
    return { hasConflict: false };
  }

  try {
    if (item.entityType === 'product') {
      const res = await AgriHubApi.getAdminProducts();
      const found = Array.isArray(res.data)
        ? res.data.find((p: any) => Number(p.id) === item.entityId)
        : null;
      const serverTs = found?.updated_at || found?.created_at;
      if (found && serverTs && new Date(serverTs).getTime() > new Date(item.baseServerUpdatedAt).getTime()) {
        return { hasConflict: true, serverData: found, serverUpdatedAt: String(serverTs) };
      }
    } else if (item.entityType === 'category') {
      const res = await AgriHubApi.getAdminCategories();
      const found = Array.isArray(res.data)
        ? res.data.find((c: any) => Number(c.id) === item.entityId)
        : null;
      const serverTs = found?.created_at;
      if (
        found &&
        serverTs &&
        new Date(serverTs).getTime() > new Date(item.baseServerUpdatedAt).getTime()
      ) {
        return { hasConflict: true, serverData: found, serverUpdatedAt: String(serverTs) };
      }
    }
  } catch {
    // If preflight check fails cleanly, let actual mutation attempt determine network/HTTP state
  }

  return { hasConflict: false };
}

async function executeQueueItem(item: SyncQueueItem): Promise<{ newServerId?: number }> {
  const key = item.idempotencyKey;
  const p = item.payload;

  switch (item.entityType) {
    case 'product': {
      if (item.operation === 'create') {
        const res = await AgriHubApi.createAdminProduct(
          {
            title: p.title,
            category_id: Number(p.category_id),
            farmer_id: p.farmer_id ? Number(p.farmer_id) : undefined,
            batch_number: p.batch_number || p.batchNumber,
            harvest_date: p.harvest_date || p.harvestDate || null,
            expiry_date: p.expiry_date || p.expiryDate || null,
            unit_price: Number(p.unit_price ?? p.unitPrice),
            unit_type: p.unit_type || p.unitType || 'kg',
            quantity_available: Number(p.quantity_available ?? p.quantityAvailable),
            storage_temp_celsius:
              p.storage_temp_celsius !== undefined
                ? Number(p.storage_temp_celsius)
                : p.storageTempCelsius !== undefined
                ? Number(p.storageTempCelsius)
                : null,
            is_organic: Boolean(p.is_organic ?? p.isOrganic),
            status: p.status || 'active',
            image_url: p.image_url || p.imageUrl || undefined
          },
          key
        );
        return { newServerId: res.data?.id ? Number(res.data.id) : undefined };
      }
      if (item.operation === 'update') {
        await AgriHubApi.updateAdminProduct(
          {
            id: item.entityId,
            title: p.title,
            category_id: Number(p.category_id),
            farmer_id: p.farmer_id ? Number(p.farmer_id) : undefined,
            batch_number: p.batch_number || p.batchNumber,
            harvest_date: p.harvest_date || p.harvestDate || null,
            expiry_date: p.expiry_date || p.expiryDate || null,
            unit_price: Number(p.unit_price ?? p.unitPrice),
            unit_type: p.unit_type || p.unitType || 'kg',
            quantity_available: Number(p.quantity_available ?? p.quantityAvailable),
            storage_temp_celsius:
              p.storage_temp_celsius !== undefined
                ? Number(p.storage_temp_celsius)
                : p.storageTempCelsius !== undefined
                ? Number(p.storageTempCelsius)
                : null,
            is_organic: Boolean(p.is_organic ?? p.isOrganic),
            status: p.status || 'active',
            image_url: p.image_url || p.imageUrl || undefined
          },
          key
        );
        return {};
      }
      if (item.operation === 'delete' && item.entityId > 0) {
        await AgriHubApi.deleteAdminProduct(item.entityId, key);
      }
      return {};
    }

    case 'category': {
      if (item.operation === 'create') {
        const res = await AgriHubApi.createCategory(
          { name: p.name, slug: p.slug, description: p.description },
          key
        );
        return { newServerId: res.data?.id ? Number(res.data.id) : undefined };
      }
      if (item.operation === 'update') {
        await AgriHubApi.updateCategory(
          { id: item.entityId, name: p.name, slug: p.slug, description: p.description },
          key
        );
        return {};
      }
      if (item.operation === 'delete' && item.entityId > 0) {
        await AgriHubApi.deleteCategory(item.entityId, key);
      }
      return {};
    }

    case 'user': {
      if (item.operation === 'create') {
        const res = await AgriHubApi.createUser(
          {
            full_name: p.full_name,
            email: p.email,
            password: p.password,
            role: p.role,
            phone: p.phone,
            business_name: p.business_name,
            tax_or_nid_no: p.tax_or_nid_no,
            address: p.address,
            is_verified: Boolean(p.is_verified)
          },
          key
        );
        return { newServerId: res.data?.id ? Number(res.data.id) : undefined };
      }
      if (item.operation === 'update') {
        if (p._verificationOnly) {
          await AgriHubApi.updateUserVerification(item.entityId, Boolean(p.is_verified), key);
        } else {
          await AgriHubApi.updateUser(
            {
              id: item.entityId,
              full_name: p.full_name,
              role: p.role,
              phone: p.phone,
              business_name: p.business_name,
              tax_or_nid_no: p.tax_or_nid_no,
              address: p.address,
              is_verified: Boolean(p.is_verified)
            },
            key
          );
        }
        return {};
      }
      if (item.operation === 'delete' && item.entityId > 0) {
        await AgriHubApi.deleteUser(item.entityId, key);
      }
      return {};
    }

    case 'order': {
      if (item.operation === 'update' && item.entityId > 0) {
        await AgriHubApi.updateOrderStatus(item.entityId, p.orderStatus || p.status, key);
      }
      return {};
    }

    case 'shipment': {
      if (item.operation === 'create') {
        await AgriHubApi.createShipment(
          {
            order_id: Number(p.order_id),
            supplier_id: p.supplier_id ? Number(p.supplier_id) : undefined,
            origin_hub: p.origin_hub || p.originHub,
            destination_hub: p.destination_hub || p.destinationHub,
            vehicle_number: p.vehicle_number || p.vehicleNumber,
            driver_name: p.driver_name || p.driverName,
            driver_phone: p.driver_phone || p.driverPhone,
            temperature_celsius: Number(p.temperature_celsius ?? p.currentTempCelsius ?? 4.5)
          },
          key
        );
      } else if (item.operation === 'update' && item.entityId > 0) {
        await AgriHubApi.updateShipment(
          {
            shipment_id: item.entityId,
            status: p.status,
            temperature_celsius:
              p.temperature_celsius !== undefined
                ? Number(p.temperature_celsius)
                : Number(p.currentTempCelsius)
          },
          key
        );
      }
      return {};
    }

    case 'warehouse': {
      // Warehouses are persisted locally in IndexedDB (no remote warehouse table in v1 schema)
      return {};
    }
  }
}

/**
 * Process all pending items in the IndexedDB sync queue sequentially in FIFO order.
 */
export async function runSyncCycle(forceAttempt = false): Promise<SyncRunSummary> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  activeSyncPromise = (async () => {
    await ensureOfflineDbSeeded();

    const pendingItems = await offlineDb.syncQueue
      .where('status')
      .anyOf(['pending', 'failed'])
      .sortBy('id');

    if (pendingItems.length === 0) {
      return {
        attempted: 0,
        synced: 0,
        failed: 0,
        conflicts: 0,
        skippedOffline: false,
        message: 'All local records are synchronized.'
      };
    }

    const browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!browserOnline) {
      return {
        attempted: 0,
        synced: 0,
        failed: 0,
        conflicts: 0,
        skippedOffline: true,
        message: 'Browser is offline. Changes remain safely saved locally.'
      };
    }

    if (!hasConfiguredBackend()) {
      await addSyncLog({
        level: 'info',
        action: 'SYNC_DEFERRED_LOCAL',
        entityType: 'system',
        message: `${pendingItems.length} local change(s) queued (no external PHP API configured).`
      });
      return {
        attempted: 0,
        synced: 0,
        failed: 0,
        conflicts: 0,
        skippedOffline: true,
        message: 'Operating in local mode (no external PHP API configured).'
      };
    }

    if (!forceAttempt) {
      const conn = await AgriHubApi.checkConnection();
      if (!conn.connected) {
        return {
          attempted: 0,
          synced: 0,
          failed: 0,
          conflicts: 0,
          skippedOffline: true,
          message: conn.message
        };
      }
    }

    // Ensure an authenticated PHP server session exists before flushing queued mutations
    try {
      const meRes = await AgriHubApi.getMe();
      if (!meRes?.success || !meRes?.data) {
        return {
          attempted: 0,
          synced: 0,
          failed: 0,
          conflicts: 0,
          skippedOffline: true,
          awaitingAuth: true,
          message: 'Server is online — sign in with server admin credentials to sync.'
        };
      }
    } catch (authErr: any) {
      if (authErr instanceof ApiError && (authErr.status === 401 || authErr.status === 403)) {
        await addSyncLog({
          level: 'info',
          action: 'SYNC_AWAITING_AUTH',
          entityType: 'system',
          message: `${pendingItems.length} local change(s) waiting — sign in with server admin credentials to sync.`
        });
        return {
          attempted: 0,
          synced: 0,
          failed: 0,
          conflicts: 0,
          skippedOffline: true,
          awaitingAuth: true,
          message: 'Server is online — sign in with server admin credentials to sync.'
        };
      }
      return {
        attempted: 0,
        synced: 0,
        failed: 0,
        conflicts: 0,
        skippedOffline: true,
        message: authErr?.message || 'Backend server is currently unreachable.'
      };
    }

    let synced = 0;
    let failed = 0;
    let conflicts = 0;

    await addSyncLog({
      level: 'info',
      action: 'SYNC_STARTED',
      entityType: 'system',
      message: `Synchronizing ${pendingItems.length} queued change(s) with PHP backend...`
    });

    for (const item of pendingItems) {
      if (!item.id) continue;

      await offlineDb.syncQueue.update(item.id, {
        status: 'syncing',
        updatedAt: new Date().toISOString()
      });

      try {
        // 1. Check for server-side modification conflict prior to update
        const conflictCheck = await checkForUpdateConflict(item);
        if (conflictCheck.hasConflict && conflictCheck.serverData) {
          const nowIso = new Date().toISOString();
          await offlineDb.conflicts.add({
            queueItemId: item.id,
            entityType: item.entityType,
            entityId: item.entityId,
            entityLabel: item.entityLabel,
            localData: item.payload,
            serverData: conflictCheck.serverData,
            localUpdatedAt: item.updatedAt,
            serverUpdatedAt: conflictCheck.serverUpdatedAt || nowIso,
            status: 'unresolved',
            detectedAt: nowIso
          });
          await offlineDb.syncQueue.update(item.id, {
            status: 'conflict',
            lastError: 'Record modified both locally and on the server.',
            updatedAt: nowIso
          });
          if (item.entityType === 'product') {
            await offlineDb.products.update(item.entityId, { syncStatus: 'conflict' });
          } else if (item.entityType === 'category') {
            await offlineDb.categories.update(item.entityId, { syncStatus: 'conflict' });
          }
          conflicts++;
          await addSyncLog({
            level: 'warning',
            action: 'CONFLICT_DETECTED',
            entityType: item.entityType,
            entityId: item.entityId,
            message: `Sync conflict detected for "${item.entityLabel}". Awaiting admin resolution.`
          });
          continue;
        }

        // 2. Push to PHP API with X-Idempotency-Key
        const result = await executeQueueItem(item);

        // 3. Mark completed & update local entity syncStatus
        await offlineDb.syncQueue.update(item.id, {
          status: 'completed',
          lastError: undefined,
          updatedAt: new Date().toISOString()
        });
        await markEntitySynced(item.entityType, item.entityId, result.newServerId);
        synced++;

        await addSyncLog({
          level: 'success',
          action: `SYNCED_${item.operation.toUpperCase()}`,
          entityType: item.entityType,
          entityId: result.newServerId ?? item.entityId,
          message: `Synced ${item.operation.toUpperCase()} "${item.entityLabel}" to backend.`
        });
      } catch (err: any) {
        const nowIso = new Date().toISOString();

        if (err instanceof ApiError && err.status === 409) {
          await offlineDb.conflicts.add({
            queueItemId: item.id,
            entityType: item.entityType,
            entityId: item.entityId,
            entityLabel: item.entityLabel,
            localData: item.payload,
            serverData: err.data?.data || { note: 'Server returned 409 Conflict' },
            localUpdatedAt: item.updatedAt,
            serverUpdatedAt: nowIso,
            status: 'unresolved',
            detectedAt: nowIso
          });
          await offlineDb.syncQueue.update(item.id, {
            status: 'conflict',
            lastError: err.message,
            updatedAt: nowIso
          });
          conflicts++;
          await addSyncLog({
            level: 'warning',
            action: 'CONFLICT_HTTP_409',
            entityType: item.entityType,
            entityId: item.entityId,
            message: `HTTP 409 Conflict for "${item.entityLabel}": ${err.message}`
          });
          continue;
        }

        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          await offlineDb.syncQueue.update(item.id, {
            status: 'pending',
            lastError: 'Sign in with server admin credentials to sync.',
            updatedAt: nowIso
          });
          await addSyncLog({
            level: 'warning',
            action: 'SYNC_AWAITING_AUTH',
            entityType: item.entityType,
            entityId: item.entityId,
            message: `Paused sync for "${item.entityLabel}": sign in to server admin account.`
          });
          break;
        }

        const msg = err?.message || 'Sync request failed';
        await offlineDb.syncQueue.update(item.id, {
          status: 'failed',
          retryCount: (item.retryCount || 0) + 1,
          lastError: msg,
          updatedAt: nowIso
        });
        failed++;

        await addSyncLog({
          level: 'error',
          action: 'SYNC_ITEM_FAILED',
          entityType: item.entityType,
          entityId: item.entityId,
          message: `Failed syncing "${item.entityLabel}": ${msg}`
        });

        // Stop batch early if network dropped mid-sync
        if (err instanceof ApiError && err.isNetworkError) {
          break;
        }
      }
    }

    return {
      attempted: pendingItems.length,
      synced,
      failed,
      conflicts,
      skippedOffline: false,
      message: `Sync finished: ${synced} synced, ${conflicts} conflict(s), ${failed} failed.`
    };
  })();

  try {
    return await activeSyncPromise;
  } finally {
    activeSyncPromise = null;
  }
}

/**
 * Resolve an unresolved sync conflict by choosing local, server, or merged values.
 */
export async function resolveSyncConflict(
  conflictId: number,
  resolution: 'local' | 'server' | 'merge',
  mergedPayload?: Record<string, any>
): Promise<void> {
  const conflict = await offlineDb.conflicts.get(conflictId);
  if (!conflict) return;

  const nowIso = new Date().toISOString();

  if (resolution === 'server') {
    if (conflict.entityType === 'product' && conflict.serverData) {
      const s = conflict.serverData;
      const existing = await offlineDb.products.get(conflict.entityId);
      if (existing) {
        await offlineDb.products.put({
          ...existing,
          title: s.title ?? existing.title,
          unitPrice: Number(s.unit_price ?? s.unitPrice ?? existing.unitPrice),
          quantityAvailable: Number(s.quantity_available ?? s.quantityAvailable ?? existing.quantityAvailable),
          status: s.status ?? existing.status,
          syncStatus: 'synced',
          serverUpdatedAt: conflict.serverUpdatedAt,
          localUpdatedAt: nowIso
        });
      }
    } else if (conflict.entityType === 'category' && conflict.serverData) {
      const s = conflict.serverData;
      const existing = await offlineDb.categories.get(conflict.entityId);
      if (existing) {
        await offlineDb.categories.put({
          ...existing,
          name: s.name ?? existing.name,
          slug: s.slug ?? existing.slug,
          description: s.description ?? existing.description,
          syncStatus: 'synced',
          serverUpdatedAt: conflict.serverUpdatedAt,
          localUpdatedAt: nowIso
        });
      }
    }

    await offlineDb.syncQueue.update(conflict.queueItemId, {
      status: 'completed',
      lastError: undefined,
      updatedAt: nowIso
    });
  } else {
    const nextPayload =
      resolution === 'merge' && mergedPayload ? mergedPayload : conflict.localData;

    if (conflict.entityType === 'product') {
      const existing = await offlineDb.products.get(conflict.entityId);
      if (existing) {
        await offlineDb.products.put({
          ...existing,
          ...nextPayload,
          unitPrice: Number(nextPayload.unit_price ?? nextPayload.unitPrice ?? existing.unitPrice),
          quantityAvailable: Number(
            nextPayload.quantity_available ?? nextPayload.quantityAvailable ?? existing.quantityAvailable
          ),
          syncStatus: 'pending',
          serverUpdatedAt: conflict.serverUpdatedAt,
          localUpdatedAt: nowIso
        });
      }
    }

    await offlineDb.syncQueue.update(conflict.queueItemId, {
      payload: nextPayload,
      baseServerUpdatedAt: conflict.serverUpdatedAt,
      status: 'pending',
      lastError: undefined,
      updatedAt: nowIso
    });
  }

  await offlineDb.conflicts.update(conflictId, {
    status: 'resolved',
    resolution,
    resolvedAt: nowIso
  });

  await addSyncLog({
    level: 'success',
    action: `CONFLICT_RESOLVED_${resolution.toUpperCase()}`,
    entityType: conflict.entityType,
    entityId: conflict.entityId,
    message: `Resolved conflict for "${conflict.entityLabel}" using ${resolution.toUpperCase()} strategy.`
  });
}

/**
 * Trigger a safe sample conflict record so hackathon judges can inspect and resolve conflicts UI
 * even without running two separate browsers simultaneously.
 */
export async function createDemoConflictSample(): Promise<void> {
  await ensureOfflineDbSeeded();
  const sampleProduct = await offlineDb.products.toCollection().first();
  if (!sampleProduct) return;

  const nowIso = new Date().toISOString();
  const queueId = await offlineDb.syncQueue.add({
    idempotencyKey: createIdempotencyKey('product', 'update', sampleProduct.id),
    entityType: 'product',
    entityId: sampleProduct.id,
    entityLabel: sampleProduct.title,
    operation: 'update',
    payload: {
      ...sampleProduct,
      unit_price: sampleProduct.unitPrice + 15,
      unitPrice: sampleProduct.unitPrice + 15,
      quantity_available: Math.max(50, sampleProduct.quantityAvailable - 120),
      quantityAvailable: Math.max(50, sampleProduct.quantityAvailable - 120)
    },
    baseServerUpdatedAt: sampleProduct.serverUpdatedAt || nowIso,
    status: 'conflict',
    retryCount: 1,
    lastError: 'Server record updated concurrently by another dispatcher.',
    createdAt: nowIso,
    updatedAt: nowIso
  });

  await offlineDb.products.update(sampleProduct.id, { syncStatus: 'conflict' });

  await offlineDb.conflicts.add({
    queueItemId: queueId,
    entityType: 'product',
    entityId: sampleProduct.id,
    entityLabel: sampleProduct.title,
    localData: {
      title: sampleProduct.title,
      unitPrice: sampleProduct.unitPrice + 15,
      quantityAvailable: Math.max(50, sampleProduct.quantityAvailable - 120),
      status: sampleProduct.status
    },
    serverData: {
      title: sampleProduct.title,
      unit_price: sampleProduct.unitPrice + 5,
      quantity_available: sampleProduct.quantityAvailable - 40,
      status: 'active'
    },
    localUpdatedAt: nowIso,
    serverUpdatedAt: nowIso,
    status: 'unresolved',
    detectedAt: nowIso
  });

  await addSyncLog({
    level: 'warning',
    action: 'CONFLICT_DETECTED',
    entityType: 'product',
    entityId: sampleProduct.id,
    message: `Simulated concurrent edit conflict on "${sampleProduct.title}" for judge review.`
  });
}

/**
 * Safely merge fresh server records into IndexedDB WITHOUT overwriting pending local edits.
 */
export async function mergeServerProductsToDexie(serverProducts: OfflineProduct[]): Promise<void> {
  await ensureOfflineDbSeeded();
  for (const srv of serverProducts) {
    const local = await offlineDb.products.get(srv.id);
    if (local && (local.syncStatus === 'pending' || local.syncStatus === 'conflict')) {
      continue;
    }
    await offlineDb.products.put({
      ...srv,
      imageUrl: srv.imageUrl || local?.imageUrl,
      syncStatus: 'synced'
    });
  }
}

export async function mergeServerCategoriesToDexie(serverCategories: OfflineCategory[]): Promise<void> {
  await ensureOfflineDbSeeded();
  for (const srv of serverCategories) {
    const local = await offlineDb.categories.get(srv.id);
    if (local && (local.syncStatus === 'pending' || local.syncStatus === 'conflict')) {
      continue;
    }
    await offlineDb.categories.put({ ...srv, syncStatus: 'synced' });
  }
}

export async function mergeServerUsersToDexie(serverUsers: OfflineUser[]): Promise<void> {
  await ensureOfflineDbSeeded();
  for (const srv of serverUsers) {
    const local = await offlineDb.users.get(srv.id);
    if (local && (local.syncStatus === 'pending' || local.syncStatus === 'conflict')) {
      continue;
    }
    await offlineDb.users.put({ ...srv, syncStatus: 'synced' });
  }
}

export async function mergeServerOrdersToDexie(serverOrders: OfflineOrder[]): Promise<void> {
  await ensureOfflineDbSeeded();
  for (const srv of serverOrders) {
    const local = await offlineDb.orders.get(srv.id);
    if (local && (local.syncStatus === 'pending' || local.syncStatus === 'conflict')) {
      continue;
    }
    await offlineDb.orders.put({ ...srv, syncStatus: 'synced' });
  }
}

export async function mergeServerShipmentsToDexie(serverShipments: OfflineShipment[]): Promise<void> {
  await ensureOfflineDbSeeded();
  for (const srv of serverShipments) {
    const local = await offlineDb.shipments.get(srv.id);
    if (local && (local.syncStatus === 'pending' || local.syncStatus === 'conflict')) {
      continue;
    }
    await offlineDb.shipments.put({ ...srv, syncStatus: 'synced' });
  }
}
