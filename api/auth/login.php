<?php
/**
 * =====================================================================
 * AgriHub API - User Login
 * File: api/auth/login.php
 * Method: POST
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(false, null, 'Method not allowed. Use POST.', 405);
}

$input = getJsonInput();
$email = filter_var(strtolower(trim((string)($input['email'] ?? ''))), FILTER_VALIDATE_EMAIL);
$password = $input['password'] ?? '';

if (!$email || !is_string($password) || $password === '') {
    sendJsonResponse(false, null, 'Valid email and password are required.', 422);
}

try {
    $pdo = Database::getConnection();

    // 1. Fetch user with prepared statement
    $stmt = $pdo->prepare("SELECT id, role, full_name, email, password_hash, business_name, is_verified 
                           FROM users 
                           WHERE email = :email 
                           LIMIT 1");
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    // 2. Verify password securely
    if (!$user || !password_verify($password, $user['password_hash'])) {
        // Generic failure prevents account enumeration attacks
        sendJsonResponse(false, null, 'Invalid email or password.', 401);
    }

    // 3. Defend against Session Fixation by regenerating Session ID
    session_regenerate_id(true);

    // 4. Store authenticated user into session
    $_SESSION['user_id']     = (int)$user['id'];
    $_SESSION['role']        = $user['role'];
    $_SESSION['full_name']   = $user['full_name'];
    $_SESSION['email']       = $user['email'];
    $_SESSION['business_name'] = $user['business_name'];
    $_SESSION['is_verified'] = (bool)$user['is_verified'];
    $_SESSION['logged_in_at']= time();

    // 5. Audit Log
    recordAuditLog($pdo, $user['id'], 'USER_LOGIN', [
        'role' => $user['role']
    ]);

    sendJsonResponse(true, [
        'id'            => (int)$user['id'],
        'role'          => $user['role'],
        'full_name'     => $user['full_name'],
        'email'         => $user['email'],
        'business_name' => $user['business_name'],
        'is_verified'   => (bool)$user['is_verified']
    ], 'Login successful.');

} catch (PDOException $e) {
    error_log("Login error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Database error during authentication.', 500);
}
