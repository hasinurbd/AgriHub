<?php
/**
 * =====================================================================
 * AgriHub API - Update Order Milestone Status
 * File: api/orders/update_status.php
 * Method: POST (or PATCH)
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

if (!in_array($_SERVER['REQUEST_METHOD'], ['POST', 'PATCH'], true)) {
    sendJsonResponse(false, null, 'Method not allowed. Use POST or PATCH.', 405);
}

$user = requireAuth();

$input = getJsonInput();
$orderId = (int)($input['order_id'] ?? 0);
$newStatus = trim((string)($input['status'] ?? ''));

$allowedStatuses = ['placed', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

if ($orderId <= 0 || !in_array($newStatus, $allowedStatuses, true)) {
    sendJsonResponse(false, null, 'Valid order ID and status are required. Allowed: ' . implode(', ', $allowedStatuses), 422);
}

$pdo = Database::getConnection();

try {
    // Fetch current order
    $stmt = $pdo->prepare("SELECT id, order_number, buyer_id, order_status FROM orders WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $orderId]);
    $order = $stmt->fetch();

    if (!$order) {
        sendJsonResponse(false, null, 'Order not found.', 404);
    }

    // Strict Role & Ownership Authorization Checks
    $allowed = false;
    if ($user['role'] === 'admin') {
        $allowed = true;
    } elseif ($user['role'] === 'farmer' && in_array($newStatus, ['confirmed', 'processing'], true)) {
        $ownCheck = $pdo->prepare(
            "SELECT COUNT(*) FROM order_items oi
             INNER JOIN products p ON oi.product_id = p.id
             WHERE oi.order_id = :order_id AND p.farmer_id = :farmer_id"
        );
        $ownCheck->execute([':order_id' => $orderId, ':farmer_id' => $user['id']]);
        $allowed = ((int)$ownCheck->fetchColumn()) > 0;
    } elseif ($user['role'] === 'supplier' && in_array($newStatus, ['shipped', 'delivered'], true)) {
        $shipCheck = $pdo->prepare(
            "SELECT supplier_id FROM logistics_shipments WHERE order_id = :order_id LIMIT 1"
        );
        $shipCheck->execute([':order_id' => $orderId]);
        $ship = $shipCheck->fetch();
        $allowed = $ship
            ? ((int)$ship['supplier_id'] === $user['id'])
            : in_array($order['order_status'], ['confirmed', 'processing'], true);
    } elseif (
        $user['role'] === 'buyer' &&
        (int)$order['buyer_id'] === $user['id'] &&
        $newStatus === 'cancelled' &&
        $order['order_status'] === 'placed'
    ) {
        $allowed = true;
    }

    if (!$allowed) {
        sendJsonResponse(false, null, 'You are not authorized to perform this order status transition.', 403);
    }

    $pdo->beginTransaction();

    // Restore stock atomically if cancelling a non-cancelled order
    if ($newStatus === 'cancelled' && $order['order_status'] !== 'cancelled') {
        $itemsStmt = $pdo->prepare("SELECT product_id, quantity FROM order_items WHERE order_id = :order_id");
        $itemsStmt->execute([':order_id' => $orderId]);
        $orderItems = $itemsStmt->fetchAll();

        $restoreStmt = $pdo->prepare(
            "UPDATE products
             SET quantity_available = quantity_available + :qty,
                 status = CASE
                    WHEN status = 'archived' THEN 'archived'
                    WHEN quantity_available + :qty2 > 50 THEN 'active'
                    ELSE 'low_stock'
                 END
             WHERE id = :product_id"
        );

        foreach ($orderItems as $oi) {
            $restoreStmt->execute([
                ':qty'        => (float)$oi['quantity'],
                ':qty2'       => (float)$oi['quantity'],
                ':product_id' => (int)$oi['product_id']
            ]);
        }
    }

    $updateStmt = $pdo->prepare("UPDATE orders SET order_status = :status WHERE id = :id");
    $updateStmt->execute([':status' => $newStatus, ':id' => $orderId]);

    $pdo->commit();

    recordAuditLog($pdo, $user['id'], 'ORDER_STATUS_UPDATED', [
        'order_id'     => $orderId,
        'order_number' => $order['order_number'],
        'old_status'   => $order['order_status'],
        'new_status'   => $newStatus
    ]);

    sendJsonResponse(true, [
        'order_id' => $orderId,
        'status'   => $newStatus
    ], "Order status updated to '{$newStatus}'.");

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Order update error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Failed to update order status.', 500);
}
