<?php
/**
 * =====================================================================
 * AgriHub API - Public Tracking & Farm-to-Fork Provenance
 * File: api/logistics/track.php
 * Method: GET
 * =====================================================================
 * Accepts query param: ?code=TRK-COLD-2026-8812
 */

require_once __DIR__ . '/../../helpers/response.php';

$code = trim($_GET['code'] ?? '');

if (empty($code)) {
    sendJsonResponse(false, null, 'Tracking code is required.', 422);
}

try {
    $pdo = Database::getConnection();

    $sql = "SELECT 
                ls.id,
                ls.tracking_code,
                ls.order_id,
                ls.vehicle_number,
                ls.driver_name,
                ls.temperature_celsius,
                ls.origin_hub,
                ls.destination_hub,
                ls.status,
                ls.dispatched_at,
                ls.estimated_delivery,
                ls.delivered_at,
                o.order_number,
                o.order_status,
                s.full_name AS carrier_name,
                s.business_name AS carrier_fleet
            FROM logistics_shipments ls
            INNER JOIN orders o ON ls.order_id = o.id
            INNER JOIN users s ON ls.supplier_id = s.id
            WHERE ls.tracking_code = :code
            LIMIT 1";

    $stmt = $pdo->prepare($sql);
    $stmt->execute([':code' => $code]);
    $shipment = $stmt->fetch();

    if (!$shipment) {
        sendJsonResponse(false, null, 'No shipment found with that tracking code.', 404);
    }

    // Also fetch the produce items and farmer batch provenance linked to this order
    $itemSql = "SELECT 
                    oi.quantity,
                    oi.unit_price,
                    p.title,
                    p.batch_number,
                    p.harvest_date,
                    p.storage_temp_celsius,
                    p.is_organic,
                    f.full_name AS farmer_name,
                    f.business_name AS farm_name,
                    f.address AS farm_location,
                    f.is_verified AS farmer_verified
                FROM order_items oi
                INNER JOIN products p ON oi.product_id = p.id
                INNER JOIN users f ON p.farmer_id = f.id
                WHERE oi.order_id = :order_id";

    $itemStmt = $pdo->prepare($itemSql);
    $itemStmt->execute([':order_id' => $shipment['order_id']]);
    $items = $itemStmt->fetchAll();

    $response = [
        'tracking_code'       => $shipment['tracking_code'],
        'order_number'        => $shipment['order_number'],
        'status'              => $shipment['status'],
        'temperature_celsius' => $shipment['temperature_celsius'] !== null ? (float)$shipment['temperature_celsius'] : null,
        'origin_hub'          => $shipment['origin_hub'],
        'destination_hub'     => $shipment['destination_hub'],
        'carrier'             => $shipment['carrier_fleet'] ?: $shipment['carrier_name'],
        'vehicle_number'      => $shipment['vehicle_number'],
        'dispatched_at'       => $shipment['dispatched_at'],
        'estimated_delivery'  => $shipment['estimated_delivery'],
        'delivered_at'        => $shipment['delivered_at'],
        'produce_batches'     => array_map(function($i) {
            return [
                'produce_title'        => $i['title'],
                'batch_number'         => $i['batch_number'],
                'harvest_date'         => $i['harvest_date'],
                'storage_temp_celsius' => (float)$i['storage_temp_celsius'],
                'is_organic'           => (bool)$i['is_organic'],
                'farmer'               => [
                    'name'        => $i['farmer_name'],
                    'farm'        => $i['farm_name'],
                    'location'    => $i['farm_location'],
                    'is_verified' => (bool)$i['farmer_verified']
                ]
            ];
        }, $items)
    ];

    sendJsonResponse(true, $response, 'Tracking and provenance details retrieved.');

} catch (PDOException $e) {
    error_log("Tracking error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Database error during tracking lookup.', 500);
}
