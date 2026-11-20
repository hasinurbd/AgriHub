<?php
/**
 * =====================================================================
 * AgriHub API - Admin Product / Harvest Batch Management (CRUD)
 * File: api/admin/products.php
 * Methods: GET, POST, PUT, PATCH, DELETE
 * Role: Admin Only
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

$admin = requireRole('admin');
$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

const ALLOWED_UNIT_TYPES = ['kg', 'ton', 'bag', 'crate', 'liter', 'box'];
const ALLOWED_PRODUCT_STATUSES = ['active', 'low_stock', 'out_of_stock', 'archived'];

function fetchJoinedProductById(PDO $pdo, int $productId): ?array {
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
                p.updated_at,
                c.name AS category_name,
                c.slug AS category_slug,
                u.full_name AS farmer_name,
                u.business_name AS farm_business_name,
                u.address AS farm_location,
                u.is_verified AS farmer_verified
            FROM products p
            INNER JOIN categories c ON p.category_id = c.id
            INNER JOIN users u ON p.farmer_id = u.id
            WHERE p.id = :id
            LIMIT 1";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([':id' => $productId]);
    $item = $stmt->fetch();
    if (!$item) {
        return null;
    }

    return formatJoinedProduct($item);
}

function formatJoinedProduct(array $item): array {
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
        'updated_at'           => $item['updated_at'],
        'category_name'        => $item['category_name'],
        'farmer_name'          => $item['farmer_name'],
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
}

function isValidDateOrNull(?string $dateStr): bool {
    if ($dateStr === null || $dateStr === '') {
        return true;
    }
    $dt = DateTime::createFromFormat('Y-m-d', $dateStr);
    return $dt !== false && $dt->format('Y-m-d') === $dateStr;
}

if ($method === 'GET') {
    try {
        $where = ["1=1"];
        $params = [];

        if (!empty($_GET['category_id'])) {
            $where[] = "p.category_id = :category_id";
            $params[':category_id'] = (int)$_GET['category_id'];
        }

        if (!empty($_GET['farmer_id'])) {
            $where[] = "p.farmer_id = :farmer_id";
            $params[':farmer_id'] = (int)$_GET['farmer_id'];
        }

        if (!empty($_GET['status']) && in_array($_GET['status'], ALLOWED_PRODUCT_STATUSES, true)) {
            $where[] = "p.status = :status";
            $params[':status'] = $_GET['status'];
        }

        if (isset($_GET['is_organic']) && $_GET['is_organic'] !== '') {
            $where[] = "p.is_organic = :is_organic";
            $params[':is_organic'] = ($_GET['is_organic'] === '1' || $_GET['is_organic'] === 'true') ? 1 : 0;
        }

        if (!empty($_GET['search'])) {
            $where[] = "(p.title LIKE :search OR p.batch_number LIKE :search OR u.full_name LIKE :search OR COALESCE(u.business_name, '') LIKE :search OR c.name LIKE :search)";
            $params[':search'] = '%' . trim((string)$_GET['search']) . '%';
        }

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
                    p.updated_at,
                    c.name AS category_name,
                    c.slug AS category_slug,
                    u.full_name AS farmer_name,
                    u.business_name AS farm_business_name,
                    u.address AS farm_location,
                    u.is_verified AS farmer_verified
                FROM products p
                INNER JOIN categories c ON p.category_id = c.id
                INNER JOIN users u ON p.farmer_id = u.id
                WHERE " . implode(' AND ', $where) . "
                ORDER BY p.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();

        $formatted = array_map('formatJoinedProduct', $rows);
        sendJsonResponse(true, $formatted, 'Products retrieved successfully.');
    } catch (PDOException $e) {
        error_log("Admin products GET error: " . $e->getMessage());
        sendJsonResponse(false, null, 'Failed to fetch products.', 500);
    }
} elseif ($method === 'POST') {
    $input = getJsonInput();

    $title = trim((string)($input['title'] ?? ''));
    $categoryId = (int)($input['category_id'] ?? 0);
    $farmerId = !empty($input['farmer_id']) ? (int)$input['farmer_id'] : (int)$admin['id'];
    $batchNumber = trim((string)($input['batch_number'] ?? ''));
    $harvestDate = !empty($input['harvest_date']) ? trim((string)$input['harvest_date']) : date('Y-m-d');
    $expiryDate = !empty($input['expiry_date']) ? trim((string)$input['expiry_date']) : null;
    $unitPrice = isset($input['unit_price']) && $input['unit_price'] !== '' ? (float)$input['unit_price'] : -1;
    $unitType = trim((string)($input['unit_type'] ?? 'kg'));
    $quantityAvailable = isset($input['quantity_available']) && $input['quantity_available'] !== '' ? (float)$input['quantity_available'] : -1;
    $storageTempCelsius = isset($input['storage_temp_celsius']) && $input['storage_temp_celsius'] !== '' && $input['storage_temp_celsius'] !== null
        ? (float)$input['storage_temp_celsius']
        : null;
    $isOrganic = !empty($input['is_organic']) ? 1 : 0;
    $status = !empty($input['status']) ? trim((string)$input['status']) : ($quantityAvailable <= 0 ? 'out_of_stock' : 'active');

    if ($batchNumber === '') {
        $batchNumber = 'BATCH-' . date('Ymd') . '-' . strtoupper(substr(md5(uniqid('', true)), 0, 6));
    }

    $errors = [];
    if (strlen($title) < 2 || strlen($title) > 180) {
        $errors[] = 'Produce title must be between 2 and 180 characters.';
    }
    if ($categoryId <= 0) {
        $errors[] = 'A valid category must be selected.';
    }
    if ($farmerId <= 0) {
        $errors[] = 'A valid producer/farmer must be selected.';
    }
    if (strlen($batchNumber) > 60) {
        $errors[] = 'Batch number must not exceed 60 characters.';
    }
    if (!isValidDateOrNull($harvestDate)) {
        $errors[] = 'Harvest date must be formatted as YYYY-MM-DD.';
    }
    if (!isValidDateOrNull($expiryDate)) {
        $errors[] = 'Expiry date must be formatted as YYYY-MM-DD.';
    }
    if ($unitPrice <= 0) {
        $errors[] = 'Unit price must be greater than zero.';
    }
    if ($quantityAvailable < 0) {
        $errors[] = 'Quantity available cannot be negative.';
    }
    if (!in_array($unitType, ALLOWED_UNIT_TYPES, true)) {
        $errors[] = 'Invalid unit type. Allowed: ' . implode(', ', ALLOWED_UNIT_TYPES);
    }
    if (!in_array($status, ALLOWED_PRODUCT_STATUSES, true)) {
        $errors[] = 'Invalid product status.';
    }
    if ($storageTempCelsius !== null && ($storageTempCelsius < -50 || $storageTempCelsius > 60)) {
        $errors[] = 'Storage temperature must be between -50°C and 60°C.';
    }

    if (!empty($errors)) {
        sendJsonResponse(false, ['errors' => $errors], implode(' ', $errors), 422);
    }

    try {
        $catCheck = $pdo->prepare("SELECT id FROM categories WHERE id = :id LIMIT 1");
        $catCheck->execute([':id' => $categoryId]);
        if (!$catCheck->fetch()) {
            sendJsonResponse(false, null, 'Selected category does not exist.', 404);
        }

        $farmerCheck = $pdo->prepare("SELECT id FROM users WHERE id = :id LIMIT 1");
        $farmerCheck->execute([':id' => $farmerId]);
        if (!$farmerCheck->fetch()) {
            sendJsonResponse(false, null, 'Selected farmer/producer does not exist.', 404);
        }

        $batchCheck = $pdo->prepare("SELECT id FROM products WHERE batch_number = :batch LIMIT 1");
        $batchCheck->execute([':batch' => $batchNumber]);
        if ($batchCheck->fetch()) {
            sendJsonResponse(false, null, "Batch number '{$batchNumber}' already exists.", 409);
        }

        $insertStmt = $pdo->prepare(
            "INSERT INTO products
                (farmer_id, category_id, title, batch_number, harvest_date, expiry_date, unit_price, unit_type, quantity_available, storage_temp_celsius, is_organic, status)
             VALUES
                (:farmer_id, :category_id, :title, :batch_number, :harvest_date, :expiry_date, :unit_price, :unit_type, :quantity_available, :storage_temp_celsius, :is_organic, :status)"
        );
        $insertStmt->execute([
            ':farmer_id'            => $farmerId,
            ':category_id'          => $categoryId,
            ':title'                => $title,
            ':batch_number'         => $batchNumber,
            ':harvest_date'         => $harvestDate,
            ':expiry_date'          => $expiryDate,
            ':unit_price'           => $unitPrice,
            ':unit_type'            => $unitType,
            ':quantity_available'   => $quantityAvailable,
            ':storage_temp_celsius' => $storageTempCelsius,
            ':is_organic'           => $isOrganic,
            ':status'               => $status
        ]);

        $newId = (int)$pdo->lastInsertId();

        recordAuditLog($pdo, $admin['id'], 'PRODUCT_CREATED', [
            'product_id'   => $newId,
            'batch_number' => $batchNumber,
            'title'        => $title,
            'category_id'  => $categoryId,
            'farmer_id'    => $farmerId,
            'quantity'     => $quantityAvailable,
            'unit'         => $unitType
        ]);

        $created = fetchJoinedProductById($pdo, $newId);
        sendJsonResponse(true, $created, 'Product created successfully.', 201);
    } catch (PDOException $e) {
        error_log("Admin products POST error: " . $e->getMessage());
        sendJsonResponse(false, null, 'Database error creating product.', 500);
    }
} elseif ($method === 'PUT' || $method === 'PATCH') {
    $input = getJsonInput();

    $id = (int)($input['id'] ?? 0);
    $title = trim((string)($input['title'] ?? ''));
    $categoryId = (int)($input['category_id'] ?? 0);
    $farmerId = !empty($input['farmer_id']) ? (int)$input['farmer_id'] : 0;
    $batchNumber = trim((string)($input['batch_number'] ?? ''));
    $harvestDate = !empty($input['harvest_date']) ? trim((string)$input['harvest_date']) : null;
    $expiryDate = !empty($input['expiry_date']) ? trim((string)$input['expiry_date']) : null;
    $unitPrice = isset($input['unit_price']) && $input['unit_price'] !== '' ? (float)$input['unit_price'] : -1;
    $unitType = trim((string)($input['unit_type'] ?? 'kg'));
    $quantityAvailable = isset($input['quantity_available']) && $input['quantity_available'] !== '' ? (float)$input['quantity_available'] : -1;
    $storageTempCelsius = isset($input['storage_temp_celsius']) && $input['storage_temp_celsius'] !== '' && $input['storage_temp_celsius'] !== null
        ? (float)$input['storage_temp_celsius']
        : null;
    $isOrganic = !empty($input['is_organic']) ? 1 : 0;
    $status = trim((string)($input['status'] ?? 'active'));

    $errors = [];
    if ($id <= 0) {
        $errors[] = 'Valid product ID is required.';
    }
    if (strlen($title) < 2 || strlen($title) > 180) {
        $errors[] = 'Produce title must be between 2 and 180 characters.';
    }
    if ($categoryId <= 0) {
        $errors[] = 'A valid category must be selected.';
    }
    if ($batchNumber === '' || strlen($batchNumber) > 60) {
        $errors[] = 'Batch number is required and must not exceed 60 characters.';
    }
    if (!isValidDateOrNull($harvestDate)) {
        $errors[] = 'Harvest date must be formatted as YYYY-MM-DD.';
    }
    if (!isValidDateOrNull($expiryDate)) {
        $errors[] = 'Expiry date must be formatted as YYYY-MM-DD.';
    }
    if ($unitPrice <= 0) {
        $errors[] = 'Unit price must be greater than zero.';
    }
    if ($quantityAvailable < 0) {
        $errors[] = 'Quantity available cannot be negative.';
    }
    if (!in_array($unitType, ALLOWED_UNIT_TYPES, true)) {
        $errors[] = 'Invalid unit type. Allowed: ' . implode(', ', ALLOWED_UNIT_TYPES);
    }
    if (!in_array($status, ALLOWED_PRODUCT_STATUSES, true)) {
        $errors[] = 'Invalid product status.';
    }
    if ($storageTempCelsius !== null && ($storageTempCelsius < -50 || $storageTempCelsius > 60)) {
        $errors[] = 'Storage temperature must be between -50°C and 60°C.';
    }

    if (!empty($errors)) {
        sendJsonResponse(false, ['errors' => $errors], implode(' ', $errors), 422);
    }

    try {
        $existsStmt = $pdo->prepare("SELECT id, farmer_id, batch_number, status FROM products WHERE id = :id LIMIT 1");
        $existsStmt->execute([':id' => $id]);
        $existing = $existsStmt->fetch();
        if (!$existing) {
            sendJsonResponse(false, null, 'Product not found.', 404);
        }

        $effectiveFarmerId = $farmerId > 0 ? $farmerId : (int)$existing['farmer_id'];

        $catCheck = $pdo->prepare("SELECT id FROM categories WHERE id = :id LIMIT 1");
        $catCheck->execute([':id' => $categoryId]);
        if (!$catCheck->fetch()) {
            sendJsonResponse(false, null, 'Selected category does not exist.', 404);
        }

        $farmerCheck = $pdo->prepare("SELECT id FROM users WHERE id = :id LIMIT 1");
        $farmerCheck->execute([':id' => $effectiveFarmerId]);
        if (!$farmerCheck->fetch()) {
            sendJsonResponse(false, null, 'Selected farmer/producer does not exist.', 404);
        }

        $batchCheck = $pdo->prepare("SELECT id FROM products WHERE batch_number = :batch AND id != :id LIMIT 1");
        $batchCheck->execute([':batch' => $batchNumber, ':id' => $id]);
        if ($batchCheck->fetch()) {
            sendJsonResponse(false, null, "Another product already uses batch number '{$batchNumber}'.", 409);
        }

        $updateStmt = $pdo->prepare(
            "UPDATE products
             SET farmer_id = :farmer_id,
                 category_id = :category_id,
                 title = :title,
                 batch_number = :batch_number,
                 harvest_date = :harvest_date,
                 expiry_date = :expiry_date,
                 unit_price = :unit_price,
                 unit_type = :unit_type,
                 quantity_available = :quantity_available,
                 storage_temp_celsius = :storage_temp_celsius,
                 is_organic = :is_organic,
                 status = :status
             WHERE id = :id"
        );
        $updateStmt->execute([
            ':farmer_id'            => $effectiveFarmerId,
            ':category_id'          => $categoryId,
            ':title'                => $title,
            ':batch_number'         => $batchNumber,
            ':harvest_date'         => $harvestDate,
            ':expiry_date'          => $expiryDate,
            ':unit_price'           => $unitPrice,
            ':unit_type'            => $unitType,
            ':quantity_available'   => $quantityAvailable,
            ':storage_temp_celsius' => $storageTempCelsius,
            ':is_organic'           => $isOrganic,
            ':status'               => $status,
            ':id'                   => $id
        ]);

        recordAuditLog($pdo, $admin['id'], 'PRODUCT_UPDATED', [
            'product_id'   => $id,
            'batch_number' => $batchNumber,
            'title'        => $title,
            'status'       => $status
        ]);

        $updated = fetchJoinedProductById($pdo, $id);
        sendJsonResponse(true, $updated, 'Product updated successfully.');
    } catch (PDOException $e) {
        error_log("Admin products PUT error: " . $e->getMessage());
        sendJsonResponse(false, null, 'Database error updating product.', 500);
    }
} elseif ($method === 'DELETE') {
    $input = getJsonInput();
    $id = (int)($input['id'] ?? $_GET['id'] ?? 0);

    if ($id <= 0) {
        sendJsonResponse(false, null, 'Valid product ID is required.', 422);
    }

    try {
        $existsStmt = $pdo->prepare("SELECT id, title, batch_number FROM products WHERE id = :id LIMIT 1");
        $existsStmt->execute([':id' => $id]);
        $existing = $existsStmt->fetch();
        if (!$existing) {
            sendJsonResponse(false, null, 'Product not found.', 404);
        }

        $orderRefStmt = $pdo->prepare("SELECT COUNT(*) FROM order_items WHERE product_id = :id");
        $orderRefStmt->execute([':id' => $id]);
        $orderItemCount = (int)$orderRefStmt->fetchColumn();

        if ($orderItemCount > 0) {
            sendJsonResponse(
                false,
                ['order_items_count' => $orderItemCount],
                "Cannot permanently delete '{$existing['batch_number']}' because it appears in {$orderItemCount} order item(s). Archive it instead to preserve order history.",
                409
            );
        }

        $delStmt = $pdo->prepare("DELETE FROM products WHERE id = :id");
        $delStmt->execute([':id' => $id]);

        recordAuditLog($pdo, $admin['id'], 'PRODUCT_DELETED', [
            'product_id'   => $id,
            'batch_number' => $existing['batch_number'],
            'title'        => $existing['title']
        ]);

        sendJsonResponse(true, ['id' => $id], 'Product deleted successfully.');
    } catch (PDOException $e) {
        error_log("Admin products DELETE error: " . $e->getMessage());
        sendJsonResponse(false, null, 'Database error deleting product.', 500);
    }
} else {
    sendJsonResponse(false, null, 'Method not allowed.', 405);
}
