<?php
/**
 * =====================================================================
 * AgriHub API - User Directory & Member Management (CRUD)
 * File: api/admin/users.php
 * Methods: GET, POST, PUT, PATCH, DELETE
 * Role: Admin Only
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

$adminUser = requireRole('admin');
$pdo = Database::getConnection();
$method = $_SERVER['REQUEST_METHOD'];

const ALLOWED_USER_ROLES = ['admin', 'farmer', 'supplier', 'buyer'];

if ($method === 'GET') {
    try {
        $where = ["1=1"];
        $params = [];

        if (!empty($_GET['role']) && in_array($_GET['role'], ALLOWED_USER_ROLES, true)) {
            $where[] = "role = :role";
            $params[':role'] = $_GET['role'];
        }

        if (!empty($_GET['search'])) {
            $where[] = "(full_name LIKE :s OR email LIKE :s OR COALESCE(business_name, '') LIKE :s)";
            $params[':s'] = '%' . trim((string)$_GET['search']) . '%';
        }

        $sql = "SELECT id, role, full_name, email, phone, business_name, tax_or_nid_no, address, is_verified, created_at, updated_at 
                FROM users 
                WHERE " . implode(' AND ', $where) . " 
                ORDER BY id ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $users = $stmt->fetchAll();

        $formatted = array_map(function($u) {
            return [
                'id'            => (int)$u['id'],
                'role'          => $u['role'],
                'full_name'     => $u['full_name'],
                'email'         => $u['email'],
                'phone'         => $u['phone'],
                'business_name' => $u['business_name'],
                'tax_or_nid_no' => $u['tax_or_nid_no'],
                'address'       => $u['address'],
                'is_verified'   => (bool)$u['is_verified'],
                'created_at'    => $u['created_at'],
                'updated_at'    => $u['updated_at']
            ];
        }, $users);

        sendJsonResponse(true, $formatted, 'Users retrieved successfully.');
    } catch (PDOException $e) {
        error_log("Users fetch error: " . $e->getMessage());
        sendJsonResponse(false, null, 'Failed to fetch users.', 500);
    }
} elseif ($method === 'POST') {
    $input = getJsonInput();
    $fullName     = trim((string)($input['full_name'] ?? ''));
    $email        = filter_var(strtolower(trim((string)($input['email'] ?? ''))), FILTER_VALIDATE_EMAIL);
    $password     = (string)($input['password'] ?? 'Password123!');
    $role         = trim((string)($input['role'] ?? 'buyer'));
    $phone        = trim((string)($input['phone'] ?? ''));
    $businessName = trim((string)($input['business_name'] ?? ''));
    $taxOrNid     = trim((string)($input['tax_or_nid_no'] ?? ''));
    $address      = trim((string)($input['address'] ?? ''));
    $isVerified   = isset($input['is_verified']) ? ($input['is_verified'] ? 1 : 0) : 1;

    if (strlen($fullName) < 2 || !$email || strlen($password) < 6 || !in_array($role, ALLOWED_USER_ROLES, true)) {
        sendJsonResponse(false, null, 'Valid name, email, role, and password (min 6 chars) are required.', 422);
    }

    try {
        $dup = $pdo->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
        $dup->execute([':email' => $email]);
        if ($dup->fetch()) {
            sendJsonResponse(false, null, 'An account with this email already exists.', 409);
        }

        $hash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 10]);
        $stmt = $pdo->prepare(
            "INSERT INTO users (role, full_name, email, phone, password_hash, business_name, tax_or_nid_no, address, is_verified)
             VALUES (:role, :full_name, :email, :phone, :password_hash, :business_name, :tax_or_nid_no, :address, :is_verified)"
        );
        $stmt->execute([
            ':role'          => $role,
            ':full_name'     => $fullName,
            ':email'         => $email,
            ':phone'         => $phone ?: null,
            ':password_hash' => $hash,
            ':business_name' => $businessName ?: null,
            ':tax_or_nid_no' => $taxOrNid ?: null,
            ':address'       => $address ?: null,
            ':is_verified'   => $isVerified
        ]);

        $newId = (int)$pdo->lastInsertId();
        recordAuditLog($pdo, $adminUser['id'], 'USER_CREATED', ['target_user_id' => $newId, 'role' => $role]);

        sendJsonResponse(true, [
            'id'            => $newId,
            'role'          => $role,
            'full_name'     => $fullName,
            'email'         => $email,
            'phone'         => $phone ?: null,
            'business_name' => $businessName ?: null,
            'tax_or_nid_no' => $taxOrNid ?: null,
            'address'       => $address ?: null,
            'is_verified'   => (bool)$isVerified,
            'created_at'    => date('Y-m-d H:i:s')
        ], 'Member account created successfully.', 201);
    } catch (PDOException $e) {
        error_log("User create error: " . $e->getMessage());
        sendJsonResponse(false, null, 'Failed to create member account.', 500);
    }
} elseif ($method === 'PUT') {
    $input = getJsonInput();
    $userId       = (int)($input['id'] ?? $input['user_id'] ?? 0);
    $fullName     = trim((string)($input['full_name'] ?? ''));
    $role         = trim((string)($input['role'] ?? ''));
    $phone        = trim((string)($input['phone'] ?? ''));
    $businessName = trim((string)($input['business_name'] ?? ''));
    $taxOrNid     = trim((string)($input['tax_or_nid_no'] ?? ''));
    $address      = trim((string)($input['address'] ?? ''));
    $isVerified   = isset($input['is_verified']) ? ($input['is_verified'] ? 1 : 0) : 1;

    if ($userId <= 0 || strlen($fullName) < 2 || !in_array($role, ALLOWED_USER_ROLES, true)) {
        sendJsonResponse(false, null, 'Valid user ID, full name, and role are required.', 422);
    }

    try {
        $stmt = $pdo->prepare(
            "UPDATE users
             SET role = :role,
                 full_name = :full_name,
                 phone = :phone,
                 business_name = :business_name,
                 tax_or_nid_no = :tax_or_nid_no,
                 address = :address,
                 is_verified = :is_verified
             WHERE id = :id"
        );
        $stmt->execute([
            ':role'          => $role,
            ':full_name'     => $fullName,
            ':phone'         => $phone ?: null,
            ':business_name' => $businessName ?: null,
            ':tax_or_nid_no' => $taxOrNid ?: null,
            ':address'       => $address ?: null,
            ':is_verified'   => $isVerified,
            ':id'            => $userId
        ]);

        recordAuditLog($pdo, $adminUser['id'], 'USER_UPDATED', ['target_user_id' => $userId, 'role' => $role]);
        sendJsonResponse(true, ['id' => $userId], 'Member details updated.');
    } catch (PDOException $e) {
        error_log("User update error: " . $e->getMessage());
        sendJsonResponse(false, null, 'Failed to update member details.', 500);
    }
} elseif ($method === 'PATCH') {
    $input = getJsonInput();
    $userId = (int)($input['user_id'] ?? 0);
    $isVerified = isset($input['is_verified']) ? ($input['is_verified'] ? 1 : 0) : 1;

    if ($userId <= 0) {
        sendJsonResponse(false, null, 'Valid user ID is required.', 422);
    }

    try {
        $stmt = $pdo->prepare("UPDATE users SET is_verified = :verified WHERE id = :id");
        $stmt->execute([':verified' => $isVerified, ':id' => $userId]);

        recordAuditLog($pdo, $adminUser['id'] ?? null, 'USER_VERIFICATION_UPDATED', [
            'target_user_id' => $userId,
            'is_verified'    => (bool)$isVerified
        ]);

        sendJsonResponse(true, ['user_id' => $userId, 'is_verified' => (bool)$isVerified], 'Member verification status updated.');
    } catch (PDOException $e) {
        error_log("User verification update error: " . $e->getMessage());
        sendJsonResponse(false, null, 'Failed to update verification.', 500);
    }
} elseif ($method === 'DELETE') {
    $input = getJsonInput();
    $userId = (int)($input['id'] ?? $_GET['id'] ?? 0);

    if ($userId <= 0) {
        sendJsonResponse(false, null, 'Valid user ID is required.', 422);
    }
    if ($userId === (int)$adminUser['id']) {
        sendJsonResponse(false, null, 'You cannot delete your own active administrator account.', 409);
    }

    try {
        $del = $pdo->prepare("DELETE FROM users WHERE id = :id");
        $del->execute([':id' => $userId]);
        recordAuditLog($pdo, $adminUser['id'], 'USER_DELETED', ['target_user_id' => $userId]);
        sendJsonResponse(true, ['id' => $userId], 'Member removed successfully.');
    } catch (PDOException $e) {
        error_log("User delete error: " . $e->getMessage());
        sendJsonResponse(false, null, 'Cannot remove member with linked orders, products, or shipments.', 409);
    }
} else {
    sendJsonResponse(false, null, 'Method not allowed.', 405);
}
