<?php
/**
 * =====================================================================
 * AgriHub API - Admin System Metrics & Aggregates
 * File: api/admin/stats.php
 * Method: GET
 * Role: Admin Only
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

requireRole('admin');

try {
    $pdo = Database::getConnection();

    // 1. User counts by role & verification
    $userStats = $pdo->query("SELECT role, COUNT(*) AS count FROM users GROUP BY role")->fetchAll(PDO::FETCH_KEY_PAIR);
    $verifiedFarmers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role = 'farmer' AND is_verified = 1")->fetchColumn();
    $verifiedUsers = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE is_verified = 1")->fetchColumn();
    $totalUsers = (int)array_sum($userStats);
    $totalFarmers = (int)($userStats['farmer'] ?? 0);
    $farmerKycPercent = $totalFarmers > 0 ? (int)round(($verifiedFarmers / $totalFarmers) * 100) : 0;

    // 2. Products & Inventory Volumes (non-archived)
    $prodStats = $pdo->query("SELECT 
                                COUNT(*) AS total_products,
                                COALESCE(SUM(quantity_available), 0) AS total_stock,
                                COALESCE(SUM(quantity_available * unit_price), 0) AS total_inventory_value,
                                COALESCE(SUM(CASE WHEN status = 'low_stock' THEN 1 ELSE 0 END), 0) AS low_stock_count
                              FROM products
                              WHERE status != 'archived'")->fetch();

    // 3. Category breakdown from categories + products
    $categoryBreakdown = $pdo->query("SELECT 
                                        c.id,
                                        c.name,
                                        COUNT(p.id) AS product_count,
                                        COALESCE(SUM(p.quantity_available), 0) AS total_stock_units
                                      FROM categories c
                                      LEFT JOIN products p ON p.category_id = c.id AND p.status != 'archived'
                                      GROUP BY c.id, c.name
                                      ORDER BY product_count DESC, c.name ASC")->fetchAll();

    $formattedCategories = array_map(function ($cat) {
        return [
            'id'                => (int)$cat['id'],
            'name'              => $cat['name'],
            'product_count'     => (int)$cat['product_count'],
            'total_stock_units' => (float)$cat['total_stock_units']
        ];
    }, $categoryBreakdown);

    // 4. Orders & Revenue (orders.total_amount, orders.order_status, orders.payment_status)
    $orderStats = $pdo->query("SELECT 
                                COUNT(*) AS total_orders,
                                COALESCE(SUM(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE 0 END), 0) AS total_revenue,
                                COALESCE(SUM(CASE WHEN payment_status = 'paid' AND order_status != 'cancelled' THEN total_amount ELSE 0 END), 0) AS paid_revenue,
                                COALESCE(SUM(CASE WHEN payment_status = 'escrow_held' AND order_status != 'cancelled' THEN total_amount ELSE 0 END), 0) AS escrow_revenue,
                                COALESCE(SUM(CASE WHEN order_status IN ('placed', 'confirmed', 'processing') THEN 1 ELSE 0 END), 0) AS pending_orders
                               FROM orders")->fetch();

    // 5. Shipments from logistics_shipments
    $shipmentStats = $pdo->query("SELECT 
                                    COUNT(*) AS total_shipments,
                                    COALESCE(SUM(CASE WHEN status IN ('assigned', 'dispatched', 'in_transit', 'customs_inspection', 'arrived') THEN 1 ELSE 0 END), 0) AS active_shipments,
                                    COALESCE(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END), 0) AS delivered_shipments,
                                    COALESCE(SUM(CASE WHEN status = 'delayed' THEN 1 ELSE 0 END), 0) AS delayed_shipments
                                  FROM logistics_shipments")->fetch();

    // 6. Recent Activity from audit_logs joined with users
    $recentActivitySql = "SELECT 
                            a.id,
                            a.user_id,
                            a.action,
                            a.ip_address,
                            a.details,
                            a.created_at,
                            u.full_name,
                            u.email,
                            u.role
                          FROM audit_logs a
                          LEFT JOIN users u ON a.user_id = u.id
                          ORDER BY a.id DESC
                          LIMIT 8";
    $recentLogs = $pdo->query($recentActivitySql)->fetchAll();

    $formattedActivity = array_map(function ($log) {
        $detailsDecoded = null;
        if (!empty($log['details'])) {
            $detailsDecoded = is_string($log['details']) ? json_decode($log['details'], true) : $log['details'];
        }

        return [
            'id'         => (int)$log['id'],
            'action'     => $log['action'],
            'ip_address' => $log['ip_address'],
            'user'       => $log['user_id'] ? [
                'id'    => (int)$log['user_id'],
                'name'  => $log['full_name'],
                'email' => $log['email'],
                'role'  => $log['role']
            ] : null,
            'details'    => $detailsDecoded,
            'created_at' => $log['created_at']
        ];
    }, $recentLogs);

    sendJsonResponse(true, [
        'users' => [
            'total'            => $totalUsers,
            'verified_total'   => $verifiedUsers,
            'by_role'          => $userStats,
            'verified_farmers' => $verifiedFarmers,
            'farmer_kyc_pct'   => $farmerKycPercent
        ],
        'products' => [
            'total_active'          => (int)$prodStats['total_products'],
            'total_stock_units'     => (float)$prodStats['total_stock'],
            'total_inventory_value' => (float)$prodStats['total_inventory_value'],
            'low_stock_count'       => (int)$prodStats['low_stock_count']
        ],
        'orders' => [
            'total_count'    => (int)$orderStats['total_orders'],
            'pending_orders' => (int)$orderStats['pending_orders'],
            'total_gmv'      => (float)$orderStats['total_revenue'],
            'total_revenue'  => (float)$orderStats['total_revenue'],
            'paid_revenue'   => (float)$orderStats['paid_revenue'],
            'escrow_revenue' => (float)$orderStats['escrow_revenue']
        ],
        'logistics' => [
            'active_shipments'    => (int)$shipmentStats['active_shipments'],
            'delivered_shipments' => (int)$shipmentStats['delivered_shipments'],
            'delayed_shipments'   => (int)$shipmentStats['delayed_shipments'],
            'total_shipments'     => (int)$shipmentStats['total_shipments']
        ],
        'categories'      => $formattedCategories,
        'recent_activity' => $formattedActivity
    ], 'Admin dashboard metrics retrieved.');

} catch (PDOException $e) {
    error_log("Admin stats error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Database error calculating stats.', 500);
}
