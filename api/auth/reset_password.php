<?php
/**
 * =====================================================================
 * AgriHub API - Password Reset & Account Recovery
 * File: api/auth/reset_password.php
 * Method: POST
 * =====================================================================
 */

require_once __DIR__ . '/../../helpers/response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse(false, null, 'Method not allowed. Use POST.', 405);
}

$input = getJsonInput();
$newPassword = (string)($input['new_password'] ?? '');

if (strlen($newPassword) < 6) {
    sendJsonResponse(false, null, 'New password must be at least 6 characters long.', 422);
}

try {
    $pdo = Database::getConnection();
    $sessionUser = getAuthUser();

    if ($sessionUser) {
        // Authenticated password update requires current password verification
        $currentPassword = (string)($input['current_password'] ?? '');
        $stmt = $pdo->prepare("SELECT id, email, password_hash FROM users WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $sessionUser['id']]);
        $user = $stmt->fetch();

        if (!$user || !password_verify($currentPassword, $user['password_hash'])) {
            sendJsonResponse(false, null, 'Current password is incorrect.', 401);
        }

        $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 10]);
        $up = $pdo->prepare("UPDATE users SET password_hash = :hash WHERE id = :id");
        $up->execute([':hash' => $newHash, ':id' => $user['id']]);

        recordAuditLog($pdo, (int)$user['id'], 'PASSWORD_CHANGED', ['email' => $user['email']]);
        sendJsonResponse(true, null, 'Password updated successfully.');
    }

    // Unauthenticated reset requires matching email + registered trade NID/tax ID or phone
    $email = filter_var(strtolower(trim((string)($input['email'] ?? ''))), FILTER_VALIDATE_EMAIL);
    $verificationRef = trim((string)($input['verification_ref'] ?? ''));

    if (!$email || $verificationRef === '') {
        sendJsonResponse(false, null, 'Valid email and registered phone or Trade License / NID number are required.', 422);
    }

    $stmt = $pdo->prepare(
        "SELECT id, email, phone, tax_or_nid_no
         FROM users
         WHERE email = :email
         LIMIT 1"
    );
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if (!$user) {
        sendJsonResponse(false, null, 'Unable to verify account details.', 403);
    }

    $normRef = preg_replace('/\s+/', '', strtolower($verificationRef));
    $normPhone = preg_replace('/\s+/', '', strtolower((string)($user['phone'] ?? '')));
    $normNid = preg_replace('/\s+/', '', strtolower((string)($user['tax_or_nid_no'] ?? '')));

    $matched = ($normPhone !== '' && $normRef === $normPhone) || ($normNid !== '' && $normRef === $normNid);
    if (!$matched) {
        sendJsonResponse(false, null, 'Account verification details do not match our records.', 403);
    }

    $newHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 10]);
    $up = $pdo->prepare("UPDATE users SET password_hash = :hash WHERE id = :id");
    $up->execute([':hash' => $newHash, ':id' => $user['id']]);

    recordAuditLog($pdo, (int)$user['id'], 'PASSWORD_RESET', ['email' => $user['email']]);
    sendJsonResponse(true, null, 'Password has been reset successfully. You may now sign in.');
} catch (PDOException $e) {
    error_log("Password reset error: " . $e->getMessage());
    sendJsonResponse(false, null, 'Unable to reset password right now.', 500);
}
