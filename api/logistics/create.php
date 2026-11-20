<?php
/**
 * =====================================================================
 * AgriHub API - Create Cold-Chain Shipment Assignment
 * File: api/logistics/create.php
 * Method: POST
 * Role: Admin, Supplier
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(false, null, 'Method not allowed. Use POST.', 405);
}

$user = requireRole(['admin', 'supplier']);
$input = getJsonInput();

$orderId = (int)($input['order_id'] ?? 0);
$supplierId = ($user['role'] === 'admin' && !empty($input['supplier_id'])) ? (int)$input['supplier_id'] : $user['id'];
$originHub = trim((string)($input['origin_hub'] ?? ''));
$destinationHub = trim((string)($input['destination_hub'] ?? ''));
$vehicleNumber = trim((string)($input['vehicle_number'] ?? ''));
$driverName = trim((string)($input['driver_name'] ?? ''));
$driverPhone = trim((string)($input['driver_phone'] ?? ''));
$temperature = isset($input['temperature_celsius']) && $input['temperature_celsius'] !== '' ? (float)$input['temperature_celsius'] : 4.5;
$estimatedDelivery = !empty($input['estimated_delivery']) ? trim((string)$input['estimated_delivery']) : date('Y-m-d H:i:s', strtotime('+18 hours'));

if ($orderId <= 0 || $originHub === '' || $destinationHub === '') {
    sendJsonResponse(false, null, 'Order ID, origin hub, and destination hub are required.', 422);
}

try {
    $pdo = Database::getConnection();

    $orderStmt = $pdo->prepare("SELECT id, order_number, order_status FROM orders WHERE id = :id LIMIT 1");
    $orderStmt->execute([':id' => $orderId]);
    $order = $orderStmt->fetch();
    if (!$order) {
        sendJsonResponse(false, null, 'Order not found.', 404);
    }
    if ($order['order_status'] === 'cancelled') {
        sendJsonResponse(false, null, 'Cannot assign shipment to a cancelled order.', 409);
    }

    $supStmt = $pdo->prepare("SELECT id FROM users WHERE id = :id LIMIT 1");
    $supStmt->execute([':id' => $supplierId]);
    if (!$supStmt->fetch()) {
        sendJsonResponse(false, null, 'Assigned transport supplier does not exist.', 404);
    }

    $trackingCode = 'TRK-COLD-' . date('Y') . '-' . str_pad((string)mt_rand(1000, 9999), 4, '0', STR_PAD_LEFT);

    $stmt = $pdo->prepare(
        "INSERT INTO logistics_shipments
            (tracking_code, order_id, supplier_id, vehicle_number, driver_name, driver_phone, temperature_celsius, origin_hub, destination_hub, status, estimated_delivery)
         VALUES
            (:tracking_code, :order_id, :supplier_id, :vehicle_number, :driver_name, :driver_phone, :temperature_celsius, :origin_hub, :destination_hub, 'assigned', :estimated_delivery)"
    );
    $stmt->execute([
        ':tracking_code'       => $trackingCode,
        ':order_id'            => $orderId,
        ':supplier_id'         => $supplierId,
        ':vehicle_number'      => $vehicleNumber ?: 'REEFER-BD-101',
        ':driver_name'         => $driverName ?: $user['full_name'],
        ':driver_phone'        => $driverPhone ?: null,
        ':temperature_celsius' => $temperature,
        ':origin_hub'          => $originHub,
        ':destination_hub'     => $destinationHub,
        ':estimated_delivery'  => $estimatedDelivery
    ]);

    $shipmentId = (int)$pdo->lastInsertId();

    recordAuditLog($pdo, $user['id'], 'SHIPMENT_ASSIGNED', [
        'shipment_id'   => $shipmentId,
        'tracking_code' => $trackingCode,
        'order_number'  => $order['order_number']
    ]);

    sendJsonResponse(true, [
        'id'            => $shipmentId,
        'tracking_code' => $trackingCode,
        'order_id'      => $orderId,
        'status'        => 'assigned'
    ], 'Cold-chain shipment assigned successfully.', 201);
} catch (PDOException $e) {
    error_log("Create shipment error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Failed to create shipment assignment.', 500);
}
