<?php
/**
 * =====================================================================
 * AgriHub API - List Products / Produce Batches
 * File: api/products/index.php
 * Method: GET
 * =====================================================================
 * Supports query filters:
 * - category_id (int)
 * - farmer_id (int)
 * - status (string: active, low_stock, out_of_stock, archived)
 * - search (string keyword)
 */

require_once __DIR__ . '/../../helpers/response.php';

try {
    $pdo = Database::getConnection();

    $whereClauses = ["1=1"];
    $params = [];

    // Optional Filter: Category
    if (!empty($_GET['category_id'])) {
        $whereClauses[] = "p.category_id = :category_id";
        $params[':category_id'] = (int)$_GET['category_id'];
    }

    // Optional Filter: Farmer
    if (!empty($_GET['farmer_id'])) {
        $whereClauses[] = "p.farmer_id = :farmer_id";
        $params[':farmer_id'] = (int)$_GET['farmer_id'];
    }

    // Optional Filter: Status (defaults to active unless specified or if logged in as admin/farmer)
    if (!empty($_GET['status'])) {
        $whereClauses[] = "p.status = :status";
        $params[':status'] = trim($_GET['status']);
    }

    // Optional Search Keyword
    if (!empty($_GET['search'])) {
        $whereClauses[] = "(p.title LIKE :search OR p.batch_number LIKE :search)";
        $params[':search'] = '%' . trim($_GET['search']) . '%';
    }

    $whereSql = implode(' AND ', $whereClauses);

    $sql = "SELECT 
                p.id,
                p.farmer_id,
                p.category_id,
                p.title,
                p.batch_number,
                p.harvest_date,
                p.expiry_date,
                p.unit_price,
                p.unit_type,
                p.quantity_available,
                p.storage_temp_celsius,
                p.is_organic,
                p.status,
                p.created_at,
                c.name AS category_name,
                c.slug AS category_slug,
                u.full_name AS farmer_name,
                u.business_name AS farm_business_name,
                u.address AS farm_location,
                u.is_verified AS farmer_verified
            FROM products p
            INNER JOIN categories c ON p.category_id = c.id
            INNER JOIN users u ON p.farmer_id = u.id
            WHERE {$whereSql}
            ORDER BY p.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $products = $stmt->fetchAll();

    // Format numeric and boolean fields cleanly for JSON
    $formatted = array_map(function($item) {
        return [
            'id'                   => (int)$item['id'],
            'farmer_id'            => (int)$item['farmer_id'],
            'category_id'          => (int)$item['category_id'],
            'title'                => $item['title'],
            'batch_number'         => $item['batch_number'],
            'harvest_date'         => $item['harvest_date'],
            'expiry_date'          => $item['expiry_date'],
            'unit_price'           => (float)$item['unit_price'],
            'unit_type'            => $item['unit_type'],
            'quantity_available'   => (float)$item['quantity_available'],
            'storage_temp_celsius' => $item['storage_temp_celsius'] !== null ? (float)$item['storage_temp_celsius'] : null,
            'is_organic'           => (bool)$item['is_organic'],
            'status'               => $item['status'],
            'created_at'           => $item['created_at'],
            'category'             => [
                'id'   => (int)$item['category_id'],
                'name' => $item['category_name'],
                'slug' => $item['category_slug']
            ],
            'farmer'               => [
                'id'            => (int)$item['farmer_id'],
                'name'          => $item['farmer_name'],
                'business_name' => $item['farm_business_name'],
                'location'      => $item['farm_location'],
                'is_verified'   => (bool)$item['farmer_verified']
            ]
        ];
    }, $products);

    sendJsonResponse(true, $formatted, 'Products retrieved successfully.');

} catch (PDOException $e) {
    error_log("Products index error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Failed to fetch products.', 500);
}
