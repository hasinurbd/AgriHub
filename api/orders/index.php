<?php
/**
 * =====================================================================
 * AgriHub API - List Orders & Order Items
 * File: api/orders/index.php
 * Method: GET
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

$user = requireAuth();

try {
    $pdo = Database::getConnection();

    $whereClauses = ["1=1"];
    $params = [];

    // Role-based visibility scoping
    if ($user['role'] === 'buyer') {
        // Buyers see only their own orders
        $whereClauses[] = "o.buyer_id = :buyer_id";
        $params[':buyer_id'] = $user['id'];
    } elseif ($user['role'] === 'farmer') {
        // Farmers see orders containing products from their farm
        $whereClauses[] = "o.id IN (SELECT oi.order_id FROM order_items oi INNER JOIN products p ON oi.product_id = p.id WHERE p.farmer_id = :farmer_id)";
        $params[':farmer_id'] = $user['id'];
    } elseif ($user['role'] === 'supplier') {
        // Suppliers see orders assigned to them or ready for fulfillment
        $whereClauses[] = "(o.id IN (SELECT ls.order_id FROM logistics_shipments ls WHERE ls.supplier_id = :supplier_id) OR o.order_status IN ('confirmed', 'processing', 'shipped'))";
        $params[':supplier_id'] = $user['id'];
    }
    // Admin sees all orders

    $whereSql = implode(' AND ', $whereClauses);

    $sql = "SELECT 
                o.id,
                o.order_number,
                o.buyer_id,
                o.total_amount,
                o.payment_status,
                o.order_status,
                o.delivery_address,
                o.notes,
                o.created_at,
                u.full_name AS buyer_name,
                u.business_name AS buyer_business_name,
                u.email AS buyer_email
            FROM orders o
            INNER JOIN users u ON o.buyer_id = u.id
            WHERE {$whereSql}
            ORDER BY o.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $orders = $stmt->fetchAll();

    if (empty($orders)) {
        sendJsonResponse(true, [], 'No orders found.');
    }

    // Fetch items for all these orders
    $orderIds = array_column($orders, 'id');
    $placeholders = implode(',', array_fill(0, count($orderIds), '?'));

    $itemsSql = "SELECT 
                    oi.id,
                    oi.order_id,
                    oi.product_id,
                    oi.quantity,
                    oi.unit_price,
                    oi.subtotal,
                    p.title AS product_title,
                    p.batch_number,
                    p.unit_type,
                    p.storage_temp_celsius,
                    p.farmer_id,
                    f.full_name AS farmer_name
                 FROM order_items oi
                 INNER JOIN products p ON oi.product_id = p.id
                 INNER JOIN users f ON p.farmer_id = f.id
                 WHERE oi.order_id IN ({$placeholders})";

    $itemsStmt = $pdo->prepare($itemsSql);
    $itemsStmt->execute($orderIds);
    $allItems = $itemsStmt->fetchAll();

    // Group items by order_id
    $itemsByOrder = [];
    foreach ($allItems as $item) {
        $itemsByOrder[$item['order_id']][] = [
            'id'                   => (int)$item['id'],
            'product_id'           => (int)$item['product_id'],
            'title'                => $item['product_title'],
            'batch_number'         => $item['batch_number'],
            'quantity'             => (float)$item['quantity'],
            'unit_type'            => $item['unit_type'],
            'unit_price'           => (float)$item['unit_price'],
            'subtotal'             => (float)$item['subtotal'],
            'storage_temp_celsius' => $item['storage_temp_celsius'] !== null ? (float)$item['storage_temp_celsius'] : null,
            'farmer'               => [
                'id'   => (int)$item['farmer_id'],
                'name' => $item['farmer_name']
            ]
        ];
    }

    $formatted = array_map(function($o) use ($itemsByOrder) {
        return [
            'id'               => (int)$o['id'],
            'order_number'     => $o['order_number'],
            'buyer'            => [
                'id'            => (int)$o['buyer_id'],
                'name'          => $o['buyer_name'],
                'business_name' => $o['buyer_business_name'],
                'email'         => $o['buyer_email']
            ],
            'total_amount'     => (float)$o['total_amount'],
            'payment_status'   => $o['payment_status'],
            'order_status'     => $o['order_status'],
            'delivery_address' => $o['delivery_address'],
            'notes'            => $o['notes'],
            'created_at'       => $o['created_at'],
            'items'            => $itemsByOrder[$o['id']] ?? []
        ];
    }, $orders);

    sendJsonResponse(true, $formatted, 'Orders retrieved successfully.');

} catch (PDOException $e) {
    error_log("Orders index error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Failed to fetch orders.', 500);
}
