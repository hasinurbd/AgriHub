<?php
/**
 * =====================================================================
 * AgriHub API - Update Shipment Status & Cold-Chain Telemetry
 * File: api/logistics/update.php
 * Method: POST (or PATCH)
 * Role: Supplier, Admin
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

$user = requireRole(['supplier', 'admin']);

$input = getJsonInput();
$shipmentId = (int)($input['shipment_id'] ?? 0);
$status = trim($input['status'] ?? '');
$temperature = isset($input['temperature_celsius']) && $input['temperature_celsius'] !== '' ? (float)$input['temperature_celsius'] : null;

$allowedStatuses = ['assigned', 'dispatched', 'in_transit', 'customs_inspection', 'arrived', 'delivered', 'delayed'];

if ($shipmentId <= 0) {
    sendJsonResponse(false, null, 'Valid shipment ID is required.', 422);
}

try {
    $pdo = Database::getConnection();

    // Check ownership if supplier
    $checkSql = "SELECT id, order_id, supplier_id, status FROM logistics_shipments WHERE id = :id";
    $checkStmt = $pdo->prepare($checkSql);
    $checkStmt->execute([':id' => $shipmentId]);
    $shipment = $checkStmt->fetch();

    if (!$shipment) {
        sendJsonResponse(false, null, 'Shipment record not found.', 404);
    }

    if ($user['role'] === 'supplier' && (int)$shipment['supplier_id'] !== $user['id']) {
        sendJsonResponse(false, null, 'You are not assigned to manage this shipment.', 403);
    }

    $updates = [];
    $params = [':id' => $shipmentId];

    if (!empty($status) && in_array($status, $allowedStatuses, true)) {
        $updates[] = "status = :status";
        $params[':status'] = $status;

        if ($status === 'dispatched') {
            $updates[] = "dispatched_at = COALESCE(dispatched_at, NOW())";
        } elseif ($status === 'delivered') {
            $updates[] = "delivered_at = NOW()";
        }
    }

    if ($temperature !== null) {
        $updates[] = "temperature_celsius = :temperature";
        $params[':temperature'] = $temperature;
    }

    if (empty($updates)) {
        sendJsonResponse(false, null, 'No valid fields provided to update.', 422);
    }

    $sql = "UPDATE logistics_shipments SET " . implode(', ', $updates) . " WHERE id = :id";
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    // If marked delivered, update corresponding order status as well
    if ($status === 'delivered') {
        $orderStmt = $pdo->prepare("UPDATE orders SET order_status = 'delivered' WHERE id = :order_id");
        $orderStmt->execute([':order_id' => $shipment['order_id']]);
    }

    recordAuditLog($pdo, $user['id'], 'SHIPMENT_UPDATED', [
        'shipment_id' => $shipmentId,
        'status'      => $status,
        'temperature' => $temperature
    ]);

    sendJsonResponse(true, [
        'shipment_id' => $shipmentId,
        'status'      => $status ?: $shipment['status'],
        'temperature' => $temperature
    ], 'Shipment telemetry and status updated successfully.');

} catch (PDOException $e) {
    error_log("Shipment update error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Failed to update shipment status.', 500);
}
