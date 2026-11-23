import { ensureOfflineDbSeeded, offlineDb } from '../lib/offlineDb';
import type { OrderItem } from '../mockData';

const DEFAULT_BCRYPT_HASH = '$2y$10$rKDNvsP//gHkaZ4PZ5jELeEfC/mK6lKEo6ivxraBxueJkumfnlEHm';

const ALLOWED_ROLES = new Set(['admin', 'farmer', 'supplier', 'buyer']);
const ALLOWED_UNIT_TYPES = new Set(['kg', 'ton', 'bag', 'crate', 'liter', 'box']);
const ALLOWED_PRODUCT_STATUSES = new Set(['active', 'low_stock', 'out_of_stock', 'archived']);
const ALLOWED_PAYMENT_STATUSES = new Set(['pending', 'escrow_held', 'paid', 'refunded']);
const ALLOWED_ORDER_STATUSES = new Set([
  'placed',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled'
]);
const ALLOWED_SHIPMENT_STATUSES = new Set([
  'assigned',
  'dispatched',
  'in_transit',
  'customs_inspection',
  'arrived',
  'delivered',
  'delayed'
]);
const ALLOWED_WAREHOUSE_STATUSES = new Set(['operational', 'near_capacity', 'maintenance']);

function sqlStr(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  const escaped = String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\0/g, '\\0')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/'/g, "''");
  return `'${escaped}'`;
}

function sqlNum(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'NULL';
  }
  return Number(value).toFixed(decimals);
}

function sqlDate(value: string | null | undefined): string {
  if (!value) return 'NULL';
  const cleaned = String(value).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return 'NULL';
  return sqlStr(cleaned);
}

function sqlTimestamp(value: string | null | undefined): string {
  if (!value) return 'CURRENT_TIMESTAMP';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'CURRENT_TIMESTAMP';
  const iso = parsed.toISOString().slice(0, 19).replace('T', ' ');
  return sqlStr(iso);
}

function buildPositiveIdMap(rawIds: number[]): Map<number, number> {
  const map = new Map<number, number>();
  let maxId = 0;
  for (const id of rawIds) {
    if (id > 0) {
      map.set(id, id);
      if (id > maxId) maxId = id;
    }
  }
  for (const id of rawIds) {
    if (id <= 0 && !map.has(id)) {
      maxId += 1;
      map.set(id, maxId);
    }
  }
  return map;
}

export interface SqlExportResult {
  filename: string;
  sql: string;
  counts: {
    users: number;
    categories: number;
    products: number;
    orders: number;
    orderItems: number;
    shipments: number;
    warehouses: number;
  };
}

export async function generateUpdatedSqlDump(extraOrders: OrderItem[] = []): Promise<SqlExportResult> {
  await ensureOfflineDbSeeded();

  const [dbUsers, dbCategories, dbProducts, dbOrders, dbShipments, dbWarehouses] = await Promise.all([
    offlineDb.users.toArray(),
    offlineDb.categories.toArray(),
    offlineDb.products.toArray(),
    offlineDb.orders.toArray(),
    offlineDb.shipments.toArray(),
    offlineDb.warehouses.toArray()
  ]);

  // Merge any extra cart/local orders that are not yet stored in Dexie
  const mergedOrdersMap = new Map<string, OrderItem>();
  for (const o of dbOrders) {
    mergedOrdersMap.set(o.orderNumber, o);
  }
  for (const eo of extraOrders) {
    if (!mergedOrdersMap.has(eo.orderNumber)) {
      mergedOrdersMap.set(eo.orderNumber, eo);
    }
  }
  const allOrders = Array.from(mergedOrdersMap.values()).sort((a, b) => a.id - b.id);

  // Build positive MySQL ID maps (handles any negative temporary offline IDs cleanly)
  const userIdMap = buildPositiveIdMap(dbUsers.map((u) => Number(u.id)));
  const categoryIdMap = buildPositiveIdMap(dbCategories.map((c) => Number(c.id)));
  const productIdMap = buildPositiveIdMap(dbProducts.map((p) => Number(p.id)));
  const orderIdMap = buildPositiveIdMap(allOrders.map((o) => Number(o.id)));
  const shipmentIdMap = buildPositiveIdMap(dbShipments.map((s) => Number(s.id)));
  const warehouseIdMap = buildPositiveIdMap(dbWarehouses.map((w) => Number(w.id)));

  // Normalize Users (deduplicate emails to respect UNIQUE index)
  const seenEmails = new Set<string>();
  const normalizedUsers = dbUsers
    .slice()
    .sort((a, b) => a.id - b.id)
    .filter((u) => {
      const email = String(u.email || '').trim().toLowerCase();
      if (!email || seenEmails.has(email)) return false;
      seenEmails.add(email);
      return true;
    })
    .map((u) => ({
      sqlId: userIdMap.get(Number(u.id)) || 1,
      role: ALLOWED_ROLES.has(u.role) ? u.role : 'buyer',
      full_name: u.full_name || 'AgriHub Member',
      email: u.email.trim(),
      phone: u.phone || null,
      business_name: u.business_name || null,
      tax_or_nid_no: u.tax_or_nid_no || null,
      address: u.address || null,
      is_verified: u.is_verified ? 1 : 0,
      created_at: u.created_at
    }));

  if (normalizedUsers.length === 0) {
    normalizedUsers.push({
      sqlId: 1,
      role: 'admin',
      full_name: 'System Administrator',
      email: 'admin@agrihub.local',
      phone: '+880 1700-000001',
      business_name: 'AgriHub Central HQ',
      tax_or_nid_no: 'GOV-TAX-90001',
      address: 'Dhaka Central Operations Centre',
      is_verified: 1,
      created_at: new Date().toISOString()
    });
  }

  const defaultAdminId = normalizedUsers.find((u) => u.role === 'admin')?.sqlId ?? normalizedUsers[0].sqlId;
  const defaultFarmerId = normalizedUsers.find((u) => u.role === 'farmer')?.sqlId ?? normalizedUsers[0].sqlId;
  const defaultSupplierId = normalizedUsers.find((u) => u.role === 'supplier')?.sqlId ?? normalizedUsers[0].sqlId;
  const defaultBuyerId = normalizedUsers.find((u) => u.role === 'buyer')?.sqlId ?? normalizedUsers[0].sqlId;

  // Normalize Categories
  const seenCatSlugs = new Set<string>();
  const seenCatNames = new Set<string>();
  const normalizedCategories = dbCategories
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((c) => {
      const sqlId = categoryIdMap.get(Number(c.id)) || 1;
      let name = (c.name || `Category ${sqlId}`).trim();
      let slug = (c.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim() || `cat-${sqlId}`;
      if (seenCatNames.has(name.toLowerCase())) name = `${name} (${sqlId})`;
      if (seenCatSlugs.has(slug.toLowerCase())) slug = `${slug}-${sqlId}`;
      seenCatNames.add(name.toLowerCase());
      seenCatSlugs.add(slug.toLowerCase());
      return {
        sqlId,
        name,
        slug,
        description: c.description || null
      };
    });

  if (normalizedCategories.length === 0) {
    normalizedCategories.push({
      sqlId: 1,
      name: 'General Produce',
      slug: 'general-produce',
      description: 'Fresh agricultural produce lots'
    });
  }
  const defaultCategoryId = normalizedCategories[0].sqlId;

  // Normalize Products
  const seenBatches = new Set<string>();
  const normalizedProducts = dbProducts
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((p) => {
      const sqlId = productIdMap.get(Number(p.id)) || 1;
      const mappedFarmer =
        (p.farmer_id ? userIdMap.get(Number(p.farmer_id)) : undefined) ??
        normalizedUsers.find(
          (u) =>
            u.full_name.toLowerCase() === String(p.farmerName || '').toLowerCase() ||
            u.business_name?.toLowerCase() === String(p.farmerName || '').toLowerCase()
        )?.sqlId ??
        defaultFarmerId;

      const mappedCategory =
        (p.category_id ? categoryIdMap.get(Number(p.category_id)) : undefined) ??
        normalizedCategories.find(
          (c) => c.name.toLowerCase() === String(p.category || '').toLowerCase()
        )?.sqlId ??
        defaultCategoryId;

      let batch = (p.batchNumber || `BATCH-${sqlId}`).trim();
      if (seenBatches.has(batch.toLowerCase())) {
        batch = `${batch}-${sqlId}`;
      }
      seenBatches.add(batch.toLowerCase());

      return {
        sqlId,
        farmer_id: mappedFarmer,
        category_id: mappedCategory,
        title: p.title || `Harvest Lot #${sqlId}`,
        batch_number: batch,
        harvest_date: p.harvestDate || null,
        expiry_date: p.expiryDate || null,
        unit_price: Number(p.unitPrice || 0),
        unit_type: ALLOWED_UNIT_TYPES.has(p.unitType) ? p.unitType : 'kg',
        quantity_available: Number(p.quantityAvailable || 0),
        storage_temp_celsius:
          p.storageTempCelsius !== undefined && p.storageTempCelsius !== null
            ? Number(p.storageTempCelsius)
            : null,
        is_organic: p.isOrganic ? 1 : 0,
        status: ALLOWED_PRODUCT_STATUSES.has(p.status) ? p.status : 'active'
      };
    });

  // Normalize Orders & Order Items
  const seenOrderNumbers = new Set<string>();
  const normalizedOrders = allOrders.map((o) => {
    const sqlId = orderIdMap.get(Number(o.id)) || 1;
    let orderNum = (o.orderNumber || `AGRI-ORD-${sqlId}`).trim();
    if (seenOrderNumbers.has(orderNum.toLowerCase())) {
      orderNum = `${orderNum}-${sqlId}`;
    }
    seenOrderNumbers.add(orderNum.toLowerCase());

    const buyerId =
      normalizedUsers.find(
        (u) =>
          (o.buyerEmail && u.email.toLowerCase() === o.buyerEmail.toLowerCase()) ||
          u.full_name.toLowerCase() === String(o.buyerName || '').toLowerCase() ||
          u.business_name?.toLowerCase() === String(o.buyerName || '').toLowerCase()
      )?.sqlId ?? defaultBuyerId;

    return {
      source: o,
      sqlId,
      order_number: orderNum,
      buyer_id: buyerId,
      total_amount: Number(o.totalAmount || 0),
      payment_status: ALLOWED_PAYMENT_STATUSES.has(o.paymentStatus) ? o.paymentStatus : 'pending',
      order_status: ALLOWED_ORDER_STATUSES.has(o.orderStatus) ? o.orderStatus : 'placed',
      delivery_address: (o.deliveryAddress || 'Dhaka Wholesale Market Hub').trim(),
      notes: o.notes || null,
      created_at: o.createdAt
    };
  });

  const normalizedOrderItems: Array<{
    id: number;
    order_id: number;
    product_id: number;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }> = [];

  if (normalizedProducts.length > 0) {
    let nextItemId = 1;
    for (const ord of normalizedOrders) {
      const lineItems =
        Array.isArray(ord.source.items) && ord.source.items.length > 0
          ? ord.source.items
          : [
              {
                productId: undefined,
                title: ord.source.productTitle,
                batchNumber: ord.source.batchNumber,
                unitPrice:
                  ord.source.unitPrice ??
                  (ord.source.quantity > 0 ? ord.total_amount / ord.source.quantity : ord.total_amount),
                quantity: ord.source.quantity || 1,
                lineTotal: ord.total_amount
              }
            ];

      for (const li of lineItems) {
        const matchedProd =
          (li.productId ? normalizedProducts.find((p) => p.sqlId === productIdMap.get(Number(li.productId))) : undefined) ??
          normalizedProducts.find(
            (p) =>
              p.batch_number.toLowerCase() === String(li.batchNumber || '').toLowerCase() ||
              p.title.toLowerCase() === String(li.title || '').toLowerCase()
          ) ??
          normalizedProducts[0];

        const qty = Number(li.quantity || 1);
        const unitPrice = Number(li.unitPrice || matchedProd.unit_price || 0);
        const subtotal = Number(li.lineTotal ?? qty * unitPrice);

        normalizedOrderItems.push({
          id: nextItemId++,
          order_id: ord.sqlId,
          product_id: matchedProd.sqlId,
          quantity: qty,
          unit_price: unitPrice,
          subtotal
        });
      }
    }
  }

  // Normalize Shipments
  const seenTracking = new Set<string>();
  const normalizedShipments: Array<{
    sqlId: number;
    tracking_code: string;
    order_id: number;
    supplier_id: number;
    vehicle_number: string | null;
    driver_name: string | null;
    driver_phone: string | null;
    temperature_celsius: number | null;
    origin_hub: string;
    destination_hub: string;
    status: string;
  }> = [];

  if (normalizedOrders.length > 0) {
    for (const s of dbShipments.slice().sort((a, b) => a.id - b.id)) {
      const sqlId = shipmentIdMap.get(Number(s.id)) || 1;
      let trk = (s.trackingCode || `TRK-${sqlId}`).trim();
      if (seenTracking.has(trk.toLowerCase())) {
        trk = `${trk}-${sqlId}`;
      }
      seenTracking.add(trk.toLowerCase());

      const matchedOrderId =
        normalizedOrders.find(
          (o) => o.order_number.toLowerCase() === String(s.orderNumber || '').toLowerCase()
        )?.sqlId ?? normalizedOrders[0].sqlId;

      const matchedSupplierId =
        normalizedUsers.find(
          (u) =>
            u.full_name.toLowerCase() === String(s.supplierName || '').toLowerCase() ||
            u.business_name?.toLowerCase() === String(s.supplierName || '').toLowerCase()
        )?.sqlId ?? defaultSupplierId;

      normalizedShipments.push({
        sqlId,
        tracking_code: trk,
        order_id: matchedOrderId,
        supplier_id: matchedSupplierId,
        vehicle_number: s.vehicleNumber || null,
        driver_name: s.driverName || null,
        driver_phone: s.driverPhone || null,
        temperature_celsius:
          s.currentTempCelsius !== undefined && s.currentTempCelsius !== null
            ? Number(s.currentTempCelsius)
            : null,
        origin_hub: (s.originHub || 'Regional Agro Depot').trim(),
        destination_hub: (s.destinationHub || 'Dhaka Distribution Hub').trim(),
        status: ALLOWED_SHIPMENT_STATUSES.has(s.status) ? s.status : 'assigned'
      });
    }
  }

  // Normalize Warehouses
  const seenWarehouseCodes = new Set<string>();
  const normalizedWarehouses = dbWarehouses
    .slice()
    .sort((a, b) => a.id - b.id)
    .map((w) => {
      const sqlId = warehouseIdMap.get(Number(w.id)) || 1;
      let code = (w.code || `WH-${sqlId}`).trim();
      if (seenWarehouseCodes.has(code.toLowerCase())) {
        code = `${code}-${sqlId}`;
      }
      seenWarehouseCodes.add(code.toLowerCase());
      return {
        sqlId,
        code,
        name: w.name || `Cold Hub #${sqlId}`,
        region: w.region || 'Dhaka',
        address: w.address || 'Regional Cold Corridor',
        capacity_tons: Number(w.capacityTons || 0),
        occupied_tons: Number(w.occupiedTons || 0),
        temp_range_celsius: w.tempRangeCelsius || '2°C - 8°C',
        manager_name: w.managerName || null,
        status: ALLOWED_WAREHOUSE_STATUSES.has(w.status) ? w.status : 'operational'
      };
    });

  const exportedAt = new Date();
  const stamp = `${exportedAt.getFullYear()}-${String(exportedAt.getMonth() + 1).padStart(2, '0')}-${String(
    exportedAt.getDate()
  ).padStart(2, '0')}_${String(exportedAt.getHours()).padStart(2, '0')}${String(
    exportedAt.getMinutes()
  ).padStart(2, '0')}`;

  const lines: string[] = [
    '-- =====================================================================',
    '-- AgriHub - Updated Database Export (Schema + Current Admin Data)',
    `-- Generated at: ${exportedAt.toISOString()}`,
    '-- Target Engine: MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.3+ (XAMPP Ready)',
    '-- Default Login Password for Admin/Users: Password123!',
    '-- =====================================================================',
    '',
    'CREATE DATABASE IF NOT EXISTS `agrihub_db`',
    '  DEFAULT CHARACTER SET utf8mb4',
    '  DEFAULT COLLATE utf8mb4_unicode_ci;',
    '',
    'USE `agrihub_db`;',
    '',
    'SET FOREIGN_KEY_CHECKS = 0;',
    '',
    'DROP TABLE IF EXISTS `warehouses`;',
    'DROP TABLE IF EXISTS `audit_logs`;',
    'DROP TABLE IF EXISTS `logistics_shipments`;',
    'DROP TABLE IF EXISTS `order_items`;',
    'DROP TABLE IF EXISTS `orders`;',
    'DROP TABLE IF EXISTS `products`;',
    'DROP TABLE IF EXISTS `categories`;',
    'DROP TABLE IF EXISTS `users`;',
    '',
    'SET FOREIGN_KEY_CHECKS = 1;',
    '',
    'CREATE TABLE `users` (',
    '  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,',
    "  `role` ENUM('admin', 'farmer', 'supplier', 'buyer') NOT NULL DEFAULT 'buyer',",
    '  `full_name` VARCHAR(120) NOT NULL,',
    '  `email` VARCHAR(150) NOT NULL UNIQUE,',
    '  `phone` VARCHAR(25) DEFAULT NULL,',
    '  `password_hash` VARCHAR(255) NOT NULL,',
    '  `business_name` VARCHAR(150) DEFAULT NULL,',
    '  `tax_or_nid_no` VARCHAR(80) DEFAULT NULL,',
    '  `address` TEXT DEFAULT NULL,',
    '  `is_verified` TINYINT(1) NOT NULL DEFAULT 0,',
    '  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,',
    '  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,',
    '  INDEX `idx_users_role` (`role`),',
    '  INDEX `idx_users_email` (`email`)',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    '',
    'CREATE TABLE `categories` (',
    '  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,',
    '  `name` VARCHAR(100) NOT NULL UNIQUE,',
    '  `slug` VARCHAR(120) NOT NULL UNIQUE,',
    '  `description` TEXT DEFAULT NULL,',
    '  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    '',
    'CREATE TABLE `products` (',
    '  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,',
    '  `farmer_id` INT UNSIGNED NOT NULL,',
    '  `category_id` INT UNSIGNED NOT NULL,',
    '  `title` VARCHAR(180) NOT NULL,',
    '  `batch_number` VARCHAR(60) NOT NULL UNIQUE,',
    '  `harvest_date` DATE DEFAULT NULL,',
    '  `expiry_date` DATE DEFAULT NULL,',
    '  `unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,',
    "  `unit_type` ENUM('kg', 'ton', 'bag', 'crate', 'liter', 'box') NOT NULL DEFAULT 'kg',",
    '  `quantity_available` DECIMAL(10,2) NOT NULL DEFAULT 0.00,',
    '  `storage_temp_celsius` DECIMAL(4,1) DEFAULT NULL,',
    '  `is_organic` TINYINT(1) NOT NULL DEFAULT 0,',
    "  `status` ENUM('active', 'low_stock', 'out_of_stock', 'archived') NOT NULL DEFAULT 'active',",
    '  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,',
    '  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,',
    '  CONSTRAINT `fk_products_farmer` FOREIGN KEY (`farmer_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,',
    '  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,',
    '  INDEX `idx_products_status` (`status`),',
    '  INDEX `idx_products_batch` (`batch_number`),',
    '  INDEX `idx_products_farmer` (`farmer_id`)',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    '',
    'CREATE TABLE `orders` (',
    '  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,',
    '  `order_number` VARCHAR(50) NOT NULL UNIQUE,',
    '  `buyer_id` INT UNSIGNED NOT NULL,',
    '  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,',
    "  `payment_status` ENUM('pending', 'escrow_held', 'paid', 'refunded') NOT NULL DEFAULT 'pending',",
    "  `order_status` ENUM('placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'placed',",
    '  `delivery_address` TEXT NOT NULL,',
    '  `notes` TEXT DEFAULT NULL,',
    '  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,',
    '  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,',
    '  CONSTRAINT `fk_orders_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,',
    '  INDEX `idx_orders_status` (`order_status`),',
    '  INDEX `idx_orders_buyer` (`buyer_id`)',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    '',
    'CREATE TABLE `order_items` (',
    '  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,',
    '  `order_id` INT UNSIGNED NOT NULL,',
    '  `product_id` INT UNSIGNED NOT NULL,',
    '  `quantity` DECIMAL(10,2) NOT NULL,',
    '  `unit_price` DECIMAL(10,2) NOT NULL,',
    '  `subtotal` DECIMAL(12,2) NOT NULL,',
    '  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,',
    '  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,',
    '  INDEX `idx_order_items_order` (`order_id`),',
    '  INDEX `idx_order_items_product` (`product_id`)',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    '',
    'CREATE TABLE `logistics_shipments` (',
    '  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,',
    '  `tracking_code` VARCHAR(60) NOT NULL UNIQUE,',
    '  `order_id` INT UNSIGNED NOT NULL,',
    '  `supplier_id` INT UNSIGNED NOT NULL,',
    '  `vehicle_number` VARCHAR(40) DEFAULT NULL,',
    '  `driver_name` VARCHAR(100) DEFAULT NULL,',
    '  `driver_phone` VARCHAR(25) DEFAULT NULL,',
    '  `temperature_celsius` DECIMAL(4,1) DEFAULT NULL,',
    '  `origin_hub` VARCHAR(150) NOT NULL,',
    '  `destination_hub` VARCHAR(150) NOT NULL,',
    "  `status` ENUM('assigned', 'dispatched', 'in_transit', 'customs_inspection', 'arrived', 'delivered', 'delayed') NOT NULL DEFAULT 'assigned',",
    '  `dispatched_at` DATETIME DEFAULT NULL,',
    '  `estimated_delivery` DATETIME DEFAULT NULL,',
    '  `delivered_at` DATETIME DEFAULT NULL,',
    '  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,',
    '  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,',
    '  CONSTRAINT `fk_shipments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,',
    '  CONSTRAINT `fk_shipments_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,',
    '  INDEX `idx_shipments_status` (`status`),',
    '  INDEX `idx_shipments_tracking` (`tracking_code`)',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    '',
    'CREATE TABLE `audit_logs` (',
    '  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,',
    '  `user_id` INT UNSIGNED DEFAULT NULL,',
    '  `action` VARCHAR(80) NOT NULL,',
    '  `ip_address` VARCHAR(45) NOT NULL,',
    '  `user_agent` VARCHAR(255) DEFAULT NULL,',
    '  `details` JSON DEFAULT NULL,',
    '  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,',
    '  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,',
    '  INDEX `idx_audit_action` (`action`),',
    '  INDEX `idx_audit_created` (`created_at`)',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    '',
    'CREATE TABLE IF NOT EXISTS `warehouses` (',
    '  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,',
    '  `code` VARCHAR(40) NOT NULL UNIQUE,',
    '  `name` VARCHAR(150) NOT NULL,',
    '  `region` VARCHAR(100) NOT NULL,',
    '  `address` TEXT NOT NULL,',
    '  `capacity_tons` DECIMAL(10,2) NOT NULL DEFAULT 0.00,',
    '  `occupied_tons` DECIMAL(10,2) NOT NULL DEFAULT 0.00,',
    "  `temp_range_celsius` VARCHAR(40) NOT NULL DEFAULT '2°C - 8°C',",
    '  `manager_name` VARCHAR(120) DEFAULT NULL,',
    "  `status` ENUM('operational', 'near_capacity', 'maintenance') NOT NULL DEFAULT 'operational',",
    '  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP',
    ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;',
    ''
  ];

  // Users INSERT
  lines.push(
    'INSERT INTO `users` (`id`, `role`, `full_name`, `email`, `phone`, `password_hash`, `business_name`, `tax_or_nid_no`, `address`, `is_verified`, `created_at`) VALUES'
  );
  lines.push(
    normalizedUsers
      .map(
        (u) =>
          `(${u.sqlId}, ${sqlStr(u.role)}, ${sqlStr(u.full_name)}, ${sqlStr(u.email)}, ${sqlStr(
            u.phone
          )}, ${sqlStr(DEFAULT_BCRYPT_HASH)}, ${sqlStr(u.business_name)}, ${sqlStr(
            u.tax_or_nid_no
          )}, ${sqlStr(u.address)}, ${u.is_verified}, ${sqlTimestamp(u.created_at)})`
      )
      .join(',\n') + ';'
  );
  lines.push('');

  // Categories INSERT
  lines.push('INSERT INTO `categories` (`id`, `name`, `slug`, `description`) VALUES');
  lines.push(
    normalizedCategories
      .map(
        (c) => `(${c.sqlId}, ${sqlStr(c.name)}, ${sqlStr(c.slug)}, ${sqlStr(c.description)})`
      )
      .join(',\n') + ';'
  );
  lines.push('');

  // Products INSERT
  if (normalizedProducts.length > 0) {
    lines.push(
      'INSERT INTO `products` (`id`, `farmer_id`, `category_id`, `title`, `batch_number`, `harvest_date`, `expiry_date`, `unit_price`, `unit_type`, `quantity_available`, `storage_temp_celsius`, `is_organic`, `status`) VALUES'
    );
    lines.push(
      normalizedProducts
        .map(
          (p) =>
            `(${p.sqlId}, ${p.farmer_id}, ${p.category_id}, ${sqlStr(p.title)}, ${sqlStr(
              p.batch_number
            )}, ${sqlDate(p.harvest_date)}, ${sqlDate(p.expiry_date)}, ${sqlNum(
              p.unit_price,
              2
            )}, ${sqlStr(p.unit_type)}, ${sqlNum(p.quantity_available, 2)}, ${sqlNum(
              p.storage_temp_celsius,
              1
            )}, ${p.is_organic}, ${sqlStr(p.status)})`
        )
        .join(',\n') + ';'
    );
    lines.push('');
  }

  // Orders INSERT
  if (normalizedOrders.length > 0) {
    lines.push(
      'INSERT INTO `orders` (`id`, `order_number`, `buyer_id`, `total_amount`, `payment_status`, `order_status`, `delivery_address`, `notes`, `created_at`) VALUES'
    );
    lines.push(
      normalizedOrders
        .map(
          (o) =>
            `(${o.sqlId}, ${sqlStr(o.order_number)}, ${o.buyer_id}, ${sqlNum(
              o.total_amount,
              2
            )}, ${sqlStr(o.payment_status)}, ${sqlStr(o.order_status)}, ${sqlStr(
              o.delivery_address
            )}, ${sqlStr(o.notes)}, ${sqlTimestamp(o.created_at)})`
        )
        .join(',\n') + ';'
    );
    lines.push('');
  }

  // Order Items INSERT
  if (normalizedOrderItems.length > 0) {
    lines.push(
      'INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `quantity`, `unit_price`, `subtotal`) VALUES'
    );
    lines.push(
      normalizedOrderItems
        .map(
          (oi) =>
            `(${oi.id}, ${oi.order_id}, ${oi.product_id}, ${sqlNum(oi.quantity, 2)}, ${sqlNum(
              oi.unit_price,
              2
            )}, ${sqlNum(oi.subtotal, 2)})`
        )
        .join(',\n') + ';'
    );
    lines.push('');
  }

  // Shipments INSERT
  if (normalizedShipments.length > 0) {
    lines.push(
      'INSERT INTO `logistics_shipments` (`id`, `tracking_code`, `order_id`, `supplier_id`, `vehicle_number`, `driver_name`, `driver_phone`, `temperature_celsius`, `origin_hub`, `destination_hub`, `status`) VALUES'
    );
    lines.push(
      normalizedShipments
        .map(
          (s) =>
            `(${s.sqlId}, ${sqlStr(s.tracking_code)}, ${s.order_id}, ${s.supplier_id}, ${sqlStr(
              s.vehicle_number
            )}, ${sqlStr(s.driver_name)}, ${sqlStr(s.driver_phone)}, ${sqlNum(
              s.temperature_celsius,
              1
            )}, ${sqlStr(s.origin_hub)}, ${sqlStr(s.destination_hub)}, ${sqlStr(s.status)})`
        )
        .join(',\n') + ';'
    );
    lines.push('');
  }

  // Warehouses INSERT
  if (normalizedWarehouses.length > 0) {
    lines.push(
      'INSERT INTO `warehouses` (`id`, `code`, `name`, `region`, `address`, `capacity_tons`, `occupied_tons`, `temp_range_celsius`, `manager_name`, `status`) VALUES'
    );
    lines.push(
      normalizedWarehouses
        .map(
          (w) =>
            `(${w.sqlId}, ${sqlStr(w.code)}, ${sqlStr(w.name)}, ${sqlStr(w.region)}, ${sqlStr(
              w.address
            )}, ${sqlNum(w.capacity_tons, 2)}, ${sqlNum(w.occupied_tons, 2)}, ${sqlStr(
              w.temp_range_celsius
            )}, ${sqlStr(w.manager_name)}, ${sqlStr(w.status)})`
        )
        .join(',\n') + ';'
    );
    lines.push('');
  }

  // Audit Log Entry
  const summaryDetails = JSON.stringify({
    event: 'Admin Panel updated SQL snapshot exported',
    exported_at: exportedAt.toISOString(),
    users: normalizedUsers.length,
    categories: normalizedCategories.length,
    products: normalizedProducts.length,
    orders: normalizedOrders.length,
    shipments: normalizedShipments.length,
    warehouses: normalizedWarehouses.length
  });
  lines.push('INSERT INTO `audit_logs` (`user_id`, `action`, `ip_address`, `user_agent`, `details`) VALUES');
  lines.push(
    `(${defaultAdminId}, 'ADMIN_SQL_SNAPSHOT_EXPORT', '127.0.0.1', 'AgriHub Admin Console', ${sqlStr(
      summaryDetails
    )});`
  );
  lines.push('');

  return {
    filename: `agrihub_updated_${stamp}.sql`,
    sql: lines.join('\n'),
    counts: {
      users: normalizedUsers.length,
      categories: normalizedCategories.length,
      products: normalizedProducts.length,
      orders: normalizedOrders.length,
      orderItems: normalizedOrderItems.length,
      shipments: normalizedShipments.length,
      warehouses: normalizedWarehouses.length
    }
  };
}

export async function downloadUpdatedSqlFile(extraOrders: OrderItem[] = []): Promise<SqlExportResult> {
  const result = await generateUpdatedSqlDump(extraOrders);
  const blob = new Blob([result.sql], { type: 'application/sql;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = result.filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return result;
}
