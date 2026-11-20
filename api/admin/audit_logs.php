<?php
/**
 * =====================================================================
 * AgriHub API - Security & Compliance Audit Logs
 * File: api/admin/audit_logs.php
 * Method: GET
 * Role: Admin Only
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

// Strict Admin RBAC
requireRole('admin');

try {
    $pdo = Database::getConnection();

    $limit = isset($_GET['limit']) ? min(100, max(1, (int)$_GET['limit'])) : 50;

    $sql = "SELECT 
                a.id,
                a.user_id,
                a.action,
                a.ip_address,
                a.user_agent,
                a.details,
                a.created_at,
                u.full_name,
                u.email,
                u.role
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.id DESC
            LIMIT :limit";

    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();
    $logs = $stmt->fetchAll();

    $formatted = array_map(function($l) {
        $detailsDecoded = null;
        if (!empty($l['details'])) {
            $detailsDecoded = is_string($l['details']) ? json_decode($l['details'], true) : $l['details'];
        }

        return [
            'id'         => (int)$l['id'],
            'action'     => $l['action'],
            'ip_address' => $l['ip_address'],
            'user'       => $l['user_id'] ? [
                'id'        => (int)$l['user_id'],
                'name'      => $l['full_name'],
                'email'     => $l['email'],
                'role'      => $l['role']
            ] : null,
            'details'    => $detailsDecoded,
            'created_at' => $l['created_at']
        ];
    }, $logs);

    sendJsonResponse(true, $formatted, 'Audit logs retrieved.');

} catch (PDOException $e) {
    error_log("Audit logs error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Database error fetching audit logs.', 500);
}
