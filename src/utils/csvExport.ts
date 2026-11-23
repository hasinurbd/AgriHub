import { ensureOfflineDbSeeded, offlineDb } from '../lib/offlineDb';
import type { OrderItem } from '../mockData';

export interface CsvExportResult {
  filename: string;
  totalRows: number;
  counts: {
    categories: number;
    users: number;
    products: number;
    orders: number;
    shipments: number;
    warehouses: number;
  };
}

function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

export async function downloadSqlStateCsvFile(
  extraOrders: OrderItem[] = []
): Promise<CsvExportResult> {
  await ensureOfflineDbSeeded();

  const [dbCategories, dbUsers, dbProducts, dbOrders, dbShipments, dbWarehouses] =
    await Promise.all([
      offlineDb.categories.toArray(),
      offlineDb.users.toArray(),
      offlineDb.products.toArray(),
      offlineDb.orders.toArray(),
      offlineDb.shipments.toArray(),
      offlineDb.warehouses.toArray()
    ]);

  // Merge any extra local orders not yet present in Dexie
  const seenOrderNums = new Set(dbOrders.map((o) => o.orderNumber));
  const mergedOrders: OrderItem[] = [...dbOrders];
  for (const extra of extraOrders) {
    if (!seenOrderNums.has(extra.orderNumber)) {
      seenOrderNums.add(extra.orderNumber);
      mergedOrders.push(extra);
    }
  }

  const sortedCategories = [...dbCategories].sort((a, b) => Number(a.id) - Number(b.id));
  const sortedUsers = [...dbUsers].sort((a, b) => Number(a.id) - Number(b.id));
  const sortedProducts = [...dbProducts].sort((a, b) => Number(b.id) - Number(a.id));
  const sortedOrders = [...mergedOrders].sort((a, b) => Number(b.id) - Number(a.id));
  const sortedShipments = [...dbShipments].sort((a, b) => Number(b.id) - Number(a.id));
  const sortedWarehouses = [...dbWarehouses].sort((a, b) => Number(a.id) - Number(b.id));

  const headers = [
    'table_name',
    'record_id',
    'code_or_slug',
    'title_or_name',
    'category_or_role',
    'status',
    'quantity_or_capacity',
    'unit',
    'price_or_total_bdt',
    'location_or_route',
    'owner_or_contact',
    'sync_status',
    'timestamp'
  ];

  const rows: Array<Array<string | number | boolean | null | undefined>> = [];

  for (const c of sortedCategories) {
    rows.push([
      'categories',
      c.id,
      c.slug,
      c.name,
      'category',
      'active',
      c.skuCount ?? 0,
      'skus',
      '',
      c.tempRange || '',
      c.description || '',
      c.syncStatus || 'synced',
      c.localUpdatedAt || ''
    ]);
  }

  for (const u of sortedUsers) {
    rows.push([
      'users',
      u.id,
      u.tax_or_nid_no || '',
      u.full_name,
      u.role,
      u.is_verified ? 'verified' : 'pending',
      '',
      '',
      '',
      u.address || '',
      `${u.business_name ? `${u.business_name} | ` : ''}${u.email}${u.phone ? ` | ${u.phone}` : ''}`,
      u.syncStatus || 'synced',
      u.localUpdatedAt || u.created_at || ''
    ]);
  }

  for (const p of sortedProducts) {
    rows.push([
      'products',
      p.id,
      p.batchNumber,
      p.title,
      p.category,
      p.status,
      p.quantityAvailable,
      p.unitType,
      p.unitPrice,
      p.farmLocation,
      p.farmerName,
      p.syncStatus || 'synced',
      p.localUpdatedAt || p.harvestDate || ''
    ]);
  }

  for (const o of sortedOrders) {
    rows.push([
      'orders',
      o.id,
      o.orderNumber,
      o.productTitle,
      o.paymentMethod || 'bank_escrow',
      `${o.orderStatus} (${o.paymentStatus})`,
      o.quantity,
      o.unitType,
      o.totalAmount,
      o.deliveryAddress || '',
      `${o.buyerName}${o.buyerEmail ? ` | ${o.buyerEmail}` : ''}`,
      (o as any).syncStatus || 'pending',
      (o as any).localUpdatedAt || o.createdAt || ''
    ]);
  }

  for (const s of sortedShipments) {
    rows.push([
      'shipments',
      s.id,
      s.trackingCode,
      s.product,
      s.orderNumber,
      s.status,
      s.currentTempCelsius,
      '°C',
      '',
      `${s.originHub} -> ${s.destinationHub}`,
      `${s.supplierName} | ${s.driverName} (${s.vehicleNumber})`,
      s.syncStatus || 'synced',
      s.localUpdatedAt || ''
    ]);
  }

  for (const w of sortedWarehouses) {
    rows.push([
      'warehouses',
      w.id,
      w.code,
      w.name,
      w.region,
      w.status,
      `${w.occupiedTons}/${w.capacityTons}`,
      'tons',
      '',
      w.address,
      `${w.managerName} (${w.tempRangeCelsius})`,
      w.syncStatus || 'synced',
      w.localUpdatedAt || ''
    ]);
  }

  const csvLines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((r) => r.map(escapeCsvCell).join(','))
  ];
  // UTF-8 BOM ensures Excel/Sheets render BDT symbol and Bangla cleanly
  const csvContent = `\uFEFF${csvLines.join('\r\n')}`;

  const dateTag = new Date().toISOString().slice(0, 10);
  const filename = `agrihub-data-state-${dateTag}.csv`;

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return {
    filename,
    totalRows: rows.length,
    counts: {
      categories: sortedCategories.length,
      users: sortedUsers.length,
      products: sortedProducts.length,
      orders: sortedOrders.length,
      shipments: sortedShipments.length,
      warehouses: sortedWarehouses.length
    }
  };
}
