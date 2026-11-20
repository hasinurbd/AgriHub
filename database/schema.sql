-- =====================================================================
-- AgriHub - Agriculture Supply Chain Management System
-- Database Schema & Initial Seed Data
-- Target Engine: MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.3+ (XAMPP Default)
-- =====================================================================

-- 1. Create Database if not exists
CREATE DATABASE IF NOT EXISTS `agrihub_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `agrihub_db`;

-- Temporarily disable foreign key checks to safely drop and rebuild if necessary
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `audit_logs`;
DROP TABLE IF EXISTS `logistics_shipments`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- Table 1: users
-- Core authentication and role-based access control table
-- =====================================================================
CREATE TABLE `users` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `role` ENUM('admin', 'farmer', 'supplier', 'buyer') NOT NULL DEFAULT 'buyer',
  `full_name` VARCHAR(120) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `phone` VARCHAR(25) DEFAULT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `business_name` VARCHAR(150) DEFAULT NULL COMMENT 'Farm name, Company name, or Store name',
  `tax_or_nid_no` VARCHAR(80) DEFAULT NULL COMMENT 'KYC registration or tax identification',
  `address` TEXT DEFAULT NULL,
  `is_verified` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = Verified by Admin, 0 = Pending verification',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_users_role` (`role`),
  INDEX `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- Table 2: categories
-- Taxonomy classification for produce, crops, grains, and livestock
-- =====================================================================
CREATE TABLE `categories` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL UNIQUE,
  `slug` VARCHAR(120) NOT NULL UNIQUE,
  `description` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- Table 3: products
-- Agricultural harvest batches listed by farmers
-- =====================================================================
CREATE TABLE `products` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `farmer_id` INT UNSIGNED NOT NULL,
  `category_id` INT UNSIGNED NOT NULL,
  `title` VARCHAR(180) NOT NULL,
  `batch_number` VARCHAR(60) NOT NULL UNIQUE COMMENT 'Unique farm harvest batch identifier for traceability',
  `harvest_date` DATE DEFAULT NULL,
  `expiry_date` DATE DEFAULT NULL,
  `unit_price` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `unit_type` ENUM('kg', 'ton', 'bag', 'crate', 'liter', 'box') NOT NULL DEFAULT 'kg',
  `quantity_available` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `storage_temp_celsius` DECIMAL(4,1) DEFAULT NULL COMMENT 'Ideal storage temperature for cold-chain compliance',
  `is_organic` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = Certified Organic, 0 = Conventional',
  `status` ENUM('active', 'low_stock', 'out_of_stock', 'archived') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_products_farmer` FOREIGN KEY (`farmer_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_products_category` FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_products_status` (`status`),
  INDEX `idx_products_batch` (`batch_number`),
  INDEX `idx_products_farmer` (`farmer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- Table 4: orders
-- Header contracts for wholesale purchase orders
-- =====================================================================
CREATE TABLE `orders` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_number` VARCHAR(50) NOT NULL UNIQUE COMMENT 'Human-friendly reference e.g., AGRI-ORD-2026-001',
  `buyer_id` INT UNSIGNED NOT NULL,
  `total_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `payment_status` ENUM('pending', 'escrow_held', 'paid', 'refunded') NOT NULL DEFAULT 'pending',
  `order_status` ENUM('placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') NOT NULL DEFAULT 'placed',
  `delivery_address` TEXT NOT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_orders_buyer` FOREIGN KEY (`buyer_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_orders_status` (`order_status`),
  INDEX `idx_orders_buyer` (`buyer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- Table 5: order_items
-- Line items capturing products, batch snapshots, and purchase prices
-- =====================================================================
CREATE TABLE `order_items` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT UNSIGNED NOT NULL,
  `product_id` INT UNSIGNED NOT NULL,
  `quantity` DECIMAL(10,2) NOT NULL,
  `unit_price` DECIMAL(10,2) NOT NULL COMMENT 'Locked historical price per unit at moment of purchase',
  `subtotal` DECIMAL(12,2) NOT NULL,
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_order_items_product` FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_order_items_order` (`order_id`),
  INDEX `idx_order_items_product` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- Table 6: logistics_shipments
-- Freight dispatch, vehicle assigning, and cold-chain temperature telemetry
-- =====================================================================
CREATE TABLE `logistics_shipments` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `tracking_code` VARCHAR(60) NOT NULL UNIQUE COMMENT 'Carrier tracking e.g., TRK-COLD-2026-8812',
  `order_id` INT UNSIGNED NOT NULL,
  `supplier_id` INT UNSIGNED NOT NULL,
  `vehicle_number` VARCHAR(40) DEFAULT NULL,
  `driver_name` VARCHAR(100) DEFAULT NULL,
  `driver_phone` VARCHAR(25) DEFAULT NULL,
  `temperature_celsius` DECIMAL(4,1) DEFAULT NULL COMMENT 'Live cold-chain reading',
  `origin_hub` VARCHAR(150) NOT NULL,
  `destination_hub` VARCHAR(150) NOT NULL,
  `status` ENUM('assigned', 'dispatched', 'in_transit', 'customs_inspection', 'arrived', 'delivered', 'delayed') NOT NULL DEFAULT 'assigned',
  `dispatched_at` DATETIME DEFAULT NULL,
  `estimated_delivery` DATETIME DEFAULT NULL,
  `delivered_at` DATETIME DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `fk_shipments_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_shipments_supplier` FOREIGN KEY (`supplier_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX `idx_shipments_status` (`status`),
  INDEX `idx_shipments_tracking` (`tracking_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- Table 7: audit_logs
-- Security, access, and transactional audit trails
-- =====================================================================
CREATE TABLE `audit_logs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT UNSIGNED DEFAULT NULL,
  `action` VARCHAR(80) NOT NULL COMMENT 'e.g. USER_LOGIN, ORDER_CREATED, STOCK_DEDUCTED',
  `ip_address` VARCHAR(45) NOT NULL,
  `user_agent` VARCHAR(255) DEFAULT NULL,
  `details` JSON DEFAULT NULL COMMENT 'JSON context payload of the event',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  INDEX `idx_audit_action` (`action`),
  INDEX `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- SEED DATA
-- Default test accounts:
-- Password for all test users is: Password123!
-- Verified PHP PASSWORD_BCRYPT (cost 10) hash of 'Password123!':
-- $2y$10$rKDNvsP//gHkaZ4PZ5jELeEfC/mK6lKEo6ivxraBxueJkumfnlEHm
-- =====================================================================

INSERT INTO `users` (`id`, `role`, `full_name`, `email`, `phone`, `password_hash`, `business_name`, `tax_or_nid_no`, `address`, `is_verified`) VALUES
(1, 'admin', 'System Administrator', 'admin@agrihub.local', '+880 1700-000001', '$2y$10$rKDNvsP//gHkaZ4PZ5jELeEfC/mK6lKEo6ivxraBxueJkumfnlEHm', 'AgriHub Central HQ', 'GOV-TAX-90001', 'Dhaka Central Operations Centre', 1),
(2, 'farmer', 'Tariq Rahman (Farmer)', 'farmer@agrihub.local', '+880 1711-111111', '$2y$10$rKDNvsP//gHkaZ4PZ5jELeEfC/mK6lKEo6ivxraBxueJkumfnlEHm', 'Green Valley Organic Agro Ltd.', 'FARM-REG-4401', 'Rajshahi Agro Valley, Plot #12', 1),
(3, 'supplier', 'Rafiqul Islam (Supplier)', 'supplier@agrihub.local', '+880 1722-222222', '$2y$10$rKDNvsP//gHkaZ4PZ5jELeEfC/mK6lKEo6ivxraBxueJkumfnlEHm', 'AgroCold Logistics Fleet #7', 'LOG-REG-8812', 'Northern Highway Cargo Depot', 1),
(4, 'buyer', 'FreshBasket Wholesale Buyer', 'buyer@agrihub.local', '+880 1733-333333', '$2y$10$rKDNvsP//gHkaZ4PZ5jELeEfC/mK6lKEo6ivxraBxueJkumfnlEHm', 'FreshBasket Supermarkets Chain', 'RET-REG-1092', 'Dhaka Wholesale Market Hub', 1);

-- Default Produce Categories
INSERT INTO `categories` (`id`, `name`, `slug`, `description`) VALUES
(1, 'Fruits & Berries', 'fruits-berries', 'Fresh orchard produce, tropical fruits, and perishable berries'),
(2, 'Grains & Cereals', 'grains-cereals', 'Rice, wheat, corn, and dry grain crops stored in silos'),
(3, 'Dairy & Cold Chain', 'dairy-cold-chain', 'Pasteurized milk, butter, and temperature-sensitive dairy products'),
(4, 'Oils & Seeds', 'oils-seeds', 'Mustard seeds, sunflower, soybeans, and edible cold-pressed oils'),
(5, 'Vegetables', 'vegetables', 'Fresh seasonal root and leafy vegetables');

-- Sample Initial Products Listed by Farmer (Tariq Rahman, ID: 2)
INSERT INTO `products` (`id`, `farmer_id`, `category_id`, `title`, `batch_number`, `harvest_date`, `expiry_date`, `unit_price`, `unit_type`, `quantity_available`, `storage_temp_celsius`, `is_organic`, `status`) VALUES
(1, 2, 1, 'Grade-A Organic Hass Avocados', 'BATCH-2026-AVO-881', '2026-11-04', '2026-11-25', 4.80, 'kg', 3400.00, 4.5, 1, 'active'),
(2, 2, 2, 'Premium Aromatic Basmati Rice', 'BATCH-2026-RIC-419', '2026-10-28', '2027-10-28', 1.65, 'kg', 12500.00, 18.0, 1, 'active'),
(3, 2, 3, 'Pasteurized Whole Milk (Chilled)', 'BATCH-2026-MLK-003', '2026-11-09', '2026-11-14', 0.95, 'liter', 850.00, 3.2, 0, 'low_stock'),
(4, 2, 4, 'Cold-Pressed Virgin Mustard Oil', 'BATCH-2026-OIL-992', '2026-11-01', '2027-05-01', 3.20, 'liter', 4200.00, 20.0, 1, 'active');

-- Sample Initial Order placed by Buyer (ID: 4)
INSERT INTO `orders` (`id`, `order_number`, `buyer_id`, `total_amount`, `payment_status`, `order_status`, `delivery_address`, `notes`) VALUES
(1, 'AGRI-ORD-2026-081', 4, 3120.00, 'escrow_held', 'shipped', 'FreshBasket Central Depot, Plot 8B, Tejgaon Industrial Area, Dhaka', 'Handle with care: maintain cold-chain under 5°C at all times');

-- Sample Order Item (650 kg Avocados @ $4.80 = $3,120.00)
INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `quantity`, `unit_price`, `subtotal`) VALUES
(1, 1, 1, 650.00, 4.80, 3120.00);

-- Sample Logistics Shipment managed by Supplier (ID: 3)
INSERT INTO `logistics_shipments` (`id`, `tracking_code`, `order_id`, `supplier_id`, `vehicle_number`, `driver_name`, `driver_phone`, `temperature_celsius`, `origin_hub`, `destination_hub`, `status`, `dispatched_at`, `estimated_delivery`) VALUES
(1, 'TRK-COLD-2026-8812', 1, 3, 'REEFER-BD-4402', 'Rafiqul Islam', '+880 1712-394851', 4.2, 'Rajshahi Agro Sorting & Cold Depot', 'Dhaka Central Distribution Center', 'in_transit', '2026-11-08 14:00:00', '2026-11-08 20:00:00');

-- Initial Audit Log
INSERT INTO `audit_logs` (`user_id`, `action`, `ip_address`, `user_agent`, `details`) VALUES
(1, 'DATABASE_INITIALIZED', '127.0.0.1', 'AgriHub System Installer', '{"event": "Schema seeded with 4 default user roles and test produce records."}');
