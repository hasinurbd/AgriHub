<?php
/**
 * =====================================================================
 * AgriHub API - Create Wholesale Order (With Atomic Stock Deduction)
 * File: api/orders/create.php
 * Method: POST
 * Role: Buyer, Admin
 * =====================================================================
 * Features:
 * 1. Strict Database Transaction (ACID compliance)
 * 2. 'FOR UPDATE' row-locking prevents overselling on race conditions
 * 3. Immediate automatic stock deduction from products table
 * 4. Automatic status transition to 'low_stock' or 'out_of_stock'
 */

require_once __DIR__ . '/../../helpers/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(false, null, 'Method not allowed. Use POST.', 405);
}

// 1. Enforce Buyer or Admin Role
$user = requireRole(['buyer', 'admin']);

$input = getJsonInput();

$items           = $input['items'] ?? [];
$deliveryAddress = trim($input['delivery_address'] ?? '');
$notes           = trim($input['notes'] ?? '');
$buyerId         = ($user['role'] === 'admin' && !empty($input['buyer_id'])) ? (int)$input['buyer_id'] : $user['id'];

// Validation
if (empty($items) || !is_array($items)) {
    sendJsonResponse(false, null, 'At least one produce item must be in the order.', 422);
}
if (empty($deliveryAddress)) {
    sendJsonResponse(false, null, 'Delivery destination address is required.', 422);
}

$pdo = Database::getConnection();

try {
    // 2. Start Atomic Transaction
    $pdo->beginTransaction();

    $totalAmount = 0.00;
    $validatedItems = [];

    // Prepared statements used inside the loop
    $productStmt = $pdo->prepare("SELECT id, title, batch_number, unit_price, unit_type, quantity_available, status 
                                  FROM products 
                                  WHERE id = :id FOR UPDATE");

    $deductStmt = $pdo->prepare("UPDATE products 
                                 SET quantity_available = quantity_available - :deduct_qty,
                                     status = CASE 
                                        WHEN quantity_available - :deduct_qty2 <= 0 THEN 'out_of_stock'
                                        WHEN quantity_available - :deduct_qty3 <= 50 THEN 'low_stock'
                                        ELSE status 
                                     END
                                 WHERE id = :id");

    foreach ($items as $item) {
        $productId = (int)($item['product_id'] ?? 0);
        $quantity  = (float)($item['quantity'] ?? 0);

        if ($productId <= 0 || $quantity <= 0) {
            $pdo->rollBack();
            sendJsonResponse(false, null, 'Invalid product ID or non-positive quantity requested.', 422);
        }

        // Lock row and check live inventory
        $productStmt->execute([':id' => $productId]);
        $product = $productStmt->fetch();

        if (!$product) {
            $pdo->rollBack();
            sendJsonResponse(false, null, "Product #{$productId} does not exist.", 404);
        }

        if ($product['status'] === 'out_of_stock' || $product['quantity_available'] < $quantity) {
            $pdo->rollBack();
            sendJsonResponse(false, null, 
                "Insufficient stock for '{$product['title']}' (Batch {$product['batch_number']}). Available: {$product['quantity_available']} {$product['unit_type']}, Requested: {$quantity} {$product['unit_type']}.", 
                400
            );
        }

        $unitPrice = (float)$product['unit_price'];
        $subtotal  = round($quantity * $unitPrice, 2);
        $totalAmount += $subtotal;

        // 3. Deduct stock immediately
        $deductStmt->execute([
            ':deduct_qty'  => $quantity,
            ':deduct_qty2' => $quantity,
            ':deduct_qty3' => $quantity,
            ':id'          => $productId
        ]);

        $validatedItems[] = [
            'product_id' => $productId,
            'title'      => $product['title'],
            'quantity'   => $quantity,
            'unit_price' => $unitPrice,
            'subtotal'   => $subtotal
        ];
    }

    // 4. Generate unique order number (e.g. AGRI-ORD-2026-XXXX)
    $orderNumber = 'AGRI-ORD-' . date('Y') . '-' . str_pad((string)mt_rand(1, 99999), 5, '0', STR_PAD_LEFT);

    // 5. Insert Order Header
    $orderStmt = $pdo->prepare("INSERT INTO orders 
        (order_number, buyer_id, total_amount, payment_status, order_status, delivery_address, notes) 
        VALUES 
        (:order_number, :buyer_id, :total_amount, 'escrow_held', 'placed', :delivery_address, :notes)");

    $orderStmt->execute([
        ':order_number'     => $orderNumber,
        ':buyer_id'         => $buyerId,
        ':total_amount'     => $totalAmount,
        ':delivery_address' => $deliveryAddress,
        ':notes'            => $notes ?: null
    ]);

    $orderId = (int)$pdo->lastInsertId();

    // 6. Insert Order Items
    $itemInsertStmt = $pdo->prepare("INSERT INTO order_items 
        (order_id, product_id, quantity, unit_price, subtotal) 
        VALUES 
        (:order_id, :product_id, :quantity, :unit_price, :subtotal)");

    foreach ($validatedItems as $vi) {
        $itemInsertStmt->execute([
            ':order_id'   => $orderId,
            ':product_id' => $vi['product_id'],
            ':quantity'   => $vi['quantity'],
            ':unit_price' => $vi['unit_price'],
            ':subtotal'   => $vi['subtotal']
        ]);
    }

    // 7. Commit Transaction
    $pdo->commit();

    // 8. Record Audit Log
    recordAuditLog($pdo, $user['id'], 'ORDER_CREATED', [
        'order_id'     => $orderId,
        'order_number' => $orderNumber,
        'total_amount' => $totalAmount,
        'items_count'  => count($validatedItems)
    ]);

    sendJsonResponse(true, [
        'order_id'       => $orderId,
        'order_number'   => $orderNumber,
        'total_amount'   => $totalAmount,
        'payment_status' => 'escrow_held',
        'order_status'   => 'placed',
        'items'          => $validatedItems
    ], 'Order placed successfully and stock deducted in database.', 201);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log("Order creation failure: " . $e->getMessage());
    sendJsonResponse(false, null, 'Unable to complete order right now. Please try again.', 500);
}
