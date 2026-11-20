import { useCallback, useEffect, useState } from 'react';
import { ensureOfflineDbSeeded, offlineDb } from '../lib/offlineDb';
import { useOfflineSync } from '../context/OfflineSyncContext';
import type { LiveDocsMetrics } from '../types/docs';

const INITIAL_METRICS: LiveDocsMetrics = {
  productsCount: 0,
  activeProductsCount: 0,
  totalStockUnits: 0,
  totalInventoryValueBdt: 0,
  categoriesCount: 0,
  usersCount: 0,
  verifiedFarmersCount: 0,
  buyersCount: 0,
  suppliersCount: 0,
  ordersCount: 0,
  totalGmvBdt: 0,
  shipmentsCount: 0,
  activeShipmentsCount: 0,
  warehousesCount: 0,
  pendingSyncCount: 0,
  syncStatusLabel: 'online',
  backendReachable: false,
  lastCheckedAt: new Date().toISOString()
};

export function useLiveDocsMetrics() {
  const { pendingCount, syncStatus, isBackendReachable, lastSyncedAt } = useOfflineSync();
  const [metrics, setMetrics] = useState<LiveDocsMetrics>(INITIAL_METRICS);
  const [loading, setLoading] = useState<boolean>(true);

  const refreshMetrics = useCallback(async () => {
    try {
      await ensureOfflineDbSeeded();
      const [products, categories, users, orders, shipments, warehouses] = await Promise.all([
        offlineDb.products.toArray(),
        offlineDb.categories.toArray(),
        offlineDb.users.toArray(),
        offlineDb.orders.toArray(),
        offlineDb.shipments.toArray(),
        offlineDb.warehouses.toArray()
      ]);

      const activeProds = products.filter((p) => p.status !== 'archived');
      const totalStockUnits = activeProds.reduce((acc, p) => acc + Number(p.quantityAvailable || 0), 0);
      const totalInventoryValueBdt = activeProds.reduce(
        (acc, p) => acc + Number(p.quantityAvailable || 0) * Number(p.unitPrice || 0),
        0
      );

      const verifiedFarmersCount = users.filter((u) => u.role === 'farmer' && u.is_verified).length;
      const buyersCount = users.filter((u) => u.role === 'buyer').length;
      const suppliersCount = users.filter((u) => u.role === 'supplier').length;

      const totalGmvBdt = orders
        .filter((o) => o.orderStatus !== 'cancelled')
        .reduce((acc, o) => acc + Number(o.totalAmount || 0), 0);

      const activeShipmentsCount = shipments.filter(
        (s) => s.status === 'assigned' || s.status === 'in_transit' || s.status === 'delayed'
      ).length;

      setMetrics({
        productsCount: products.length,
        activeProductsCount: activeProds.length,
        totalStockUnits,
        totalInventoryValueBdt,
        categoriesCount: categories.length,
        usersCount: users.length,
        verifiedFarmersCount,
        buyersCount,
        suppliersCount,
        ordersCount: orders.length,
        totalGmvBdt,
        shipmentsCount: shipments.length,
        activeShipmentsCount,
        warehousesCount: warehouses.length,
        pendingSyncCount: pendingCount,
        syncStatusLabel: syncStatus,
        backendReachable: isBackendReachable,
        lastCheckedAt: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  }, [pendingCount, syncStatus, isBackendReachable]);

  useEffect(() => {
    refreshMetrics();
  }, [refreshMetrics, lastSyncedAt]);

  return { metrics, loading, refreshMetrics };
}
