<?php
/**
 * =====================================================================
 * AgriHub API - User Logout
 * File: api/auth/logout.php
 * Method: POST or GET
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

$userId = $_SESSION['user_id'] ?? null;

if ($userId) {
    try {
        $pdo = Database::getConnection();
        recordAuditLog($pdo, (int)$userId, 'USER_LOGOUT');
    } catch (Exception $e) {
        // Ignore error on logout audit
    }
}

destroyAuthSession();

sendJsonResponse(true, null, 'Logged out successfully.');
