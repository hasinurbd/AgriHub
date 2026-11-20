<?php
/**
 * =====================================================================
 * AgriHub API - Current User Session Profile
 * File: api/auth/me.php
 * Method: GET
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

$user = getAuthUser();

if (!$user) {
    sendJsonResponse(false, null, 'Not authenticated', 401);
}

// Fetch fresh details from database to ensure up-to-date verification/status
try {
    $pdo = Database::getConnection();
    $stmt = $pdo->prepare("SELECT id, role, full_name, email, phone, business_name, tax_or_nid_no, address, is_verified, created_at 
                           FROM users WHERE id = :id LIMIT 1");
    $stmt->execute([':id' => $user['id']]);
    $freshUser = $stmt->fetch();

    if (!$freshUser) {
        // User was removed from DB
        destroyAuthSession();
        sendJsonResponse(false, null, 'User no longer exists.', 401);
    }

    $_SESSION['user_id']       = (int)$freshUser['id'];
    $_SESSION['role']          = $freshUser['role'];
    $_SESSION['full_name']     = $freshUser['full_name'];
    $_SESSION['email']         = $freshUser['email'];
    $_SESSION['business_name'] = $freshUser['business_name'];
    $_SESSION['is_verified']   = (bool)$freshUser['is_verified'];

    sendJsonResponse(true, [
        'id'            => (int)$freshUser['id'],
        'role'          => $freshUser['role'],
        'full_name'     => $freshUser['full_name'],
        'email'         => $freshUser['email'],
        'phone'         => $freshUser['phone'],
        'business_name' => $freshUser['business_name'],
        'address'       => $freshUser['address'],
        'is_verified'   => (bool)$freshUser['is_verified'],
        'created_at'    => $freshUser['created_at']
    ], 'Current session active.');

} catch (PDOException $e) {
    error_log("Me endpoint error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Database error.', 500);
}
