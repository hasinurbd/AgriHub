<?php
/**
 * =====================================================================
 * AgriHub API - List Logistics Shipments & Cold-Chain Telemetry
 * File: api/logistics/index.php
 * Method: GET
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

$user = requireAuth();

try {
    $pdo = Database::getConnection();

    $whereClauses = ["1=1"];
    $params = [];

    if ($user['role'] === 'supplier') {
        $whereClauses[] = "ls.supplier_id = :supplier_id";
        $params[':supplier_id'] = $user['id'];
    } elseif ($user['role'] === 'buyer') {
        $whereClauses[] = "o.buyer_id = :buyer_id";
        $params[':buyer_id'] = $user['id'];
    } elseif ($user['role'] === 'farmer') {
        $whereClauses[] = "o.id IN (SELECT oi.order_id FROM order_items oi INNER JOIN products p ON oi.product_id = p.id WHERE p.farmer_id = :farmer_id)";
        $params[':farmer_id'] = $user['id'];
    }

    $whereSql = implode(' AND ', $whereClauses);

    $sql = "SELECT 
                ls.id,
                ls.tracking_code,
                ls.order_id,
                ls.supplier_id,
                ls.vehicle_number,
                ls.driver_name,
                ls.driver_phone,
                ls.temperature_celsius,
                ls.origin_hub,
                ls.destination_hub,
                ls.status,
                ls.dispatched_at,
                ls.estimated_delivery,
                ls.delivered_at,
                ls.created_at,
                o.order_number,
                o.total_amount,
                o.order_status,
                s.full_name AS supplier_name,
                s.business_name AS supplier_fleet_name
            FROM logistics_shipments ls
            INNER JOIN orders o ON ls.order_id = o.id
            INNER JOIN users s ON ls.supplier_id = s.id
            WHERE {$whereSql}
            ORDER BY ls.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $shipments = $stmt->fetchAll();

    $formatted = array_map(function($s) {
        return [
            'id'                  => (int)$s['id'],
            'tracking_code'       => $s['tracking_code'],
            'order_id'            => (int)$s['order_id'],
            'order_number'        => $s['order_number'],
            'order_status'        => $s['order_status'],
            'vehicle_number'      => $s['vehicle_number'],
            'driver_name'         => $s['driver_name'],
            'driver_phone'        => $s['driver_phone'],
            'temperature_celsius' => $s['temperature_celsius'] !== null ? (float)$s['temperature_celsius'] : null,
            'origin_hub'          => $s['origin_hub'],
            'destination_hub'     => $s['destination_hub'],
            'status'              => $s['status'],
            'dispatched_at'       => $s['dispatched_at'],
            'estimated_delivery'  => $s['estimated_delivery'],
            'delivered_at'        => $s['delivered_at'],
            'created_at'          => $s['created_at'],
            'supplier'            => [
                'id'            => (int)$s['supplier_id'],
                'name'          => $s['supplier_name'],
                'business_name' => $s['supplier_fleet_name']
            ]
        ];
    }, $shipments);

    sendJsonResponse(true, $formatted, 'Shipments retrieved successfully.');

} catch (PDOException $e) {
    error_log("Logistics index error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Failed to fetch shipments.', 500);
}
