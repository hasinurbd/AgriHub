<?php
/**
 * =====================================================================
 * AgriHub API - User Registration
 * File: api/auth/register.php
 * Method: POST
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(false, null, 'Method not allowed. Use POST.', 405);
}

$input = getJsonInput();

// 1. Sanitize & Validate Inputs
$fullName     = trim((string)($input['full_name'] ?? ''));
$email        = filter_var(strtolower(trim((string)($input['email'] ?? ''))), FILTER_VALIDATE_EMAIL);
$password     = $input['password'] ?? '';
$role         = trim((string)($input['role'] ?? 'buyer'));
$phone        = trim((string)($input['phone'] ?? ''));
$businessName = trim((string)($input['business_name'] ?? ''));
$taxOrNid     = trim((string)($input['tax_or_nid_no'] ?? ''));
$address      = trim((string)($input['address'] ?? ''));

$errors = [];

if (empty($fullName) || strlen($fullName) < 2) {
    $errors[] = 'Full name must be at least 2 characters.';
}
if (!$email) {
    $errors[] = 'A valid email address is required.';
}
if (!is_string($password) || strlen($password) < 6) {
    $errors[] = 'Password must be at least 6 characters long.';
}
// Public registration must never grant admin privileges
$allowedRoles = ['farmer', 'supplier', 'buyer'];
if (!in_array($role, $allowedRoles, true)) {
    $errors[] = 'Invalid role selected. Allowed: ' . implode(', ', $allowedRoles);
}

if (!empty($errors)) {
    sendJsonResponse(false, ['errors' => $errors], 'Validation failed.', 422);
}

try {
    $pdo = Database::getConnection();

    // 2. Check if email already exists
    $checkStmt = $pdo->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
    $checkStmt->execute([':email' => $email]);
    if ($checkStmt->fetch()) {
        sendJsonResponse(false, null, 'An account with this email already exists.', 409);
    }

    // 3. Hash Password Securely with Bcrypt
    $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);

    // Farmers and Suppliers require verification by default; Buyers can be auto-verified
    $isVerified = ($role === 'buyer') ? 1 : 0;

    // 4. Insert into users table using PDO prepared statement
    $insertStmt = $pdo->prepare("INSERT INTO users 
        (role, full_name, email, phone, password_hash, business_name, tax_or_nid_no, address, is_verified) 
        VALUES 
        (:role, :full_name, :email, :phone, :password_hash, :business_name, :tax_or_nid_no, :address, :is_verified)");

    $insertStmt->execute([
        ':role'          => $role,
        ':full_name'     => $fullName,
        ':email'         => $email,
        ':phone'         => $phone ?: null,
        ':password_hash' => $passwordHash,
        ':business_name' => $businessName ?: null,
        ':tax_or_nid_no' => $taxOrNid ?: null,
        ':address'       => $address ?: null,
        ':is_verified'   => $isVerified
    ]);

    $newUserId = (int)$pdo->lastInsertId();

    // 5. Audit Log
    recordAuditLog($pdo, $newUserId, 'USER_REGISTERED', [
        'email' => $email,
        'role'  => $role
    ]);

    // Return created user (without password hash)
    sendJsonResponse(true, [
        'id'          => $newUserId,
        'role'        => $role,
        'full_name'   => $fullName,
        'email'       => $email,
        'business_name' => $businessName,
        'is_verified' => (bool)$isVerified
    ], 'User registration successful.', 201);

} catch (PDOException $e) {
    error_log("Registration error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Database error during registration.', 500);
}
