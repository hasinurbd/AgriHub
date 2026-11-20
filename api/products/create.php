<?php
/**
 * =====================================================================
 * AgriHub API - Create Product / Harvest Batch
 * File: api/products/create.php
 * Method: POST
 * Role: Farmer, Admin
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(false, null, 'Method not allowed. Use POST.', 405);
}

// 1. Enforce Role: Farmer or Admin
$user = requireRole(['farmer', 'admin']);

$input = getJsonInput();

// 2. Validate Inputs
$title               = trim($input['title'] ?? '');
$categoryId          = (int)($input['category_id'] ?? 0);
$batchNumber         = trim($input['batch_number'] ?? '');
$harvestDate         = !empty($input['harvest_date']) ? trim($input['harvest_date']) : date('Y-m-d');
$expiryDate          = !empty($input['expiry_date']) ? trim($input['expiry_date']) : null;
$unitPrice           = (float)($input['unit_price'] ?? 0);
$unitType            = trim($input['unit_type'] ?? 'kg');
$quantityAvailable   = (float)($input['quantity_available'] ?? 0);
$storageTempCelsius  = isset($input['storage_temp_celsius']) && $input['storage_temp_celsius'] !== '' ? (float)$input['storage_temp_celsius'] : null;
$isOrganic           = !empty($input['is_organic']) ? 1 : 0;
$farmerId            = ($user['role'] === 'admin' && !empty($input['farmer_id'])) ? (int)$input['farmer_id'] : $user['id'];

$errors = [];
if (empty($title) || strlen($title) < 2) {
    $errors[] = 'Produce title must be at least 2 characters.';
}
if ($categoryId <= 0) {
    $errors[] = 'A valid category must be selected.';
}
if ($unitPrice <= 0) {
    $errors[] = 'Unit price must be greater than zero.';
}
if ($quantityAvailable <= 0) {
    $errors[] = 'Quantity available must be greater than zero.';
}
$allowedUnits = ['kg', 'ton', 'bag', 'crate', 'liter', 'box'];
if (!in_array($unitType, $allowedUnits, true)) {
    $errors[] = 'Invalid unit type. Allowed: ' . implode(', ', $allowedUnits);
}

// Auto-generate batch number if omitted
if (empty($batchNumber)) {
    $batchNumber = 'BATCH-' . date('Ymd') . '-' . strtoupper(substr(md5(uniqid()), 0, 6));
}

if (!empty($errors)) {
    sendJsonResponse(false, ['errors' => $errors], 'Validation failed.', 422);
}

try {
    $pdo = Database::getConnection();

    // 3. Verify category exists
    $catCheck = $pdo->prepare("SELECT id FROM categories WHERE id = :id LIMIT 1");
    $catCheck->execute([':id' => $categoryId]);
    if (!$catCheck->fetch()) {
        sendJsonResponse(false, null, 'The selected category does not exist.', 404);
    }

    // 4. Verify batch number uniqueness
    $batchCheck = $pdo->prepare("SELECT id FROM products WHERE batch_number = :batch LIMIT 1");
    $batchCheck->execute([':batch' => $batchNumber]);
    if ($batchCheck->fetch()) {
        sendJsonResponse(false, null, "Batch number '{$batchNumber}' is already registered. Please use a unique batch identifier.", 409);
    }

    // 5. Insert new produce with prepared statement
    $stmt = $pdo->prepare("INSERT INTO products 
        (farmer_id, category_id, title, batch_number, harvest_date, expiry_date, unit_price, unit_type, quantity_available, storage_temp_celsius, is_organic, status) 
        VALUES 
        (:farmer_id, :category_id, :title, :batch_number, :harvest_date, :expiry_date, :unit_price, :unit_type, :quantity_available, :storage_temp_celsius, :is_organic, 'active')");

    $stmt->execute([
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
        ':is_organic'           => $isOrganic
    ]);

    $newProductId = (int)$pdo->lastInsertId();

    // 6. Record Audit Trail
    recordAuditLog($pdo, $user['id'], 'PRODUCT_CREATED', [
        'product_id'   => $newProductId,
        'batch_number' => $batchNumber,
        'title'        => $title,
        'quantity'     => $quantityAvailable,
        'unit'         => $unitType
    ]);

    sendJsonResponse(true, [
        'id'                  => $newProductId,
        'farmer_id'           => $farmerId,
        'category_id'         => $categoryId,
        'title'               => $title,
        'batch_number'        => $batchNumber,
        'quantity_available'  => $quantityAvailable,
        'unit_price'          => $unitPrice,
        'unit_type'           => $unitType,
        'status'              => 'active'
    ], 'Harvest batch registered successfully into inventory.', 201);

} catch (PDOException $e) {
    error_log("Product create error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Unable to register harvest batch right now.', 500);
}
