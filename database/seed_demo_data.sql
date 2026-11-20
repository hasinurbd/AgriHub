-- =====================================================================
-- AgriHub - Extended Demo Seed Dataset (Non-Destructive)
-- Adds 50 Products, 20 Farmers, 20 Buyers, 25 Orders, 10 Shipments, 5 Warehouses
-- Password for all seeded users: Password123!
-- =====================================================================

USE `agrihub_db`;

CREATE TABLE IF NOT EXISTS `warehouses` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(40) NOT NULL UNIQUE,
  `name` VARCHAR(150) NOT NULL,
  `region` VARCHAR(100) NOT NULL,
  `address` TEXT NOT NULL,
  `capacity_tons` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `occupied_tons` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `temp_range_celsius` VARCHAR(40) NOT NULL DEFAULT '2°C - 8°C',
  `manager_name` VARCHAR(120) DEFAULT NULL,
  `status` ENUM('operational', 'near_capacity', 'maintenance') NOT NULL DEFAULT 'operational',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO `warehouses` (`id`, `code`, `name`, `region`, `address`, `capacity_tons`, `occupied_tons`, `temp_range_celsius`, `manager_name`, `status`) VALUES
(1, 'WH-DHK-01', 'Dhaka Central Cold Hub', 'Dhaka', 'Plot 8B, Tejgaon Industrial Corridor, Dhaka', 1200.00, 840.00, '2°C - 6°C', 'Mahmudul Hasan', 'operational'),
(2, 'WH-RAJ-02', 'Rajshahi Mango & Orchard Depot', 'Rajshahi', 'Godagari Agro Industrial Zone, Rajshahi', 850.00, 690.00, '3°C - 8°C', 'Tariqul Islam', 'near_capacity'),
(3, 'WH-BOG-03', 'Bogura Northern Vegetable Vault', 'Bogura', 'Sherpur Highway Agro Park, Bogura', 950.00, 520.00, '2°C - 5°C', 'Kamrul Chowdhury', 'operational'),
(4, 'WH-CTG-04', 'Chattogram Port Reefer Terminal', 'Chattogram', 'Halishahar Export Logistics Park, Chattogram', 1500.00, 910.00, '0°C - 4°C', 'Nusrat Jahan', 'operational'),
(5, 'WH-SYL-05', 'Sylhet Tea & Citrus Hub', 'Sylhet', 'Sreemangal Agro Collection Center, Sylhet', 600.00, 310.00, '4°C - 12°C', 'Farhan Ahmed', 'operational');
