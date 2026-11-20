<?php
/**
 * =====================================================================
 * AgriHub - Temporary Local CLI Admin Password Reset Utility
 * File: scripts/reset_admin_password.php
 * =====================================================================
 * SECURITY RULES:
 * 1. CLI-only execution (immediately returns HTTP 403 via Apache/web).
 * 2. Uses PHP password_hash() with PASSWORD_BCRYPT and cost 10.
 * 3. Uses PDO prepared statements.
 * 4. Delete this file immediately after resetting the local password.
 *
 * Usage (from C:\xampp\htdocs\agrihub):
 *   C:\xampp\php\php.exe scripts\reset_admin_password.php
 * Or pass a password directly:
 *   C:\xampp\php\php.exe scripts\reset_admin_password.php --password=YourNewPassword
 * Optional: also repair the other 3 seeded test accounts:
 *   C:\xampp\php\php.exe scripts\reset_admin_password.php --password=Password123! --fix-test-users
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    header('Content-Type: text/plain; charset=UTF-8');
    exit("403 Forbidden: This utility can only be run from the local command line (CLI).\n");
}

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';

$options = getopt('', ['email::', 'password::', 'fix-test-users']);
$targetEmail = isset($options['email']) && trim((string)$options['email']) !== ''
    ? strtolower(trim((string)$options['email']))
    : 'admin@agrihub.local';
$newPassword = isset($options['password']) ? (string)$options['password'] : '';
$fixTestUsers = array_key_exists('fix-test-users', $options);

if ($newPassword === '') {
    fwrite(STDOUT, "Enter new password for {$targetEmail} (min 8 chars): ");
    $line = fgets(STDIN);
    $newPassword = $line !== false ? rtrim($line, "\r\n") : '';
}

if (strlen($newPassword) < 8) {
    fwrite(STDERR, "Error: Password must be at least 8 characters long.\n");
    exit(1);
}

$hash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 10]);
if ($hash === false || !password_verify($newPassword, $hash)) {
    fwrite(STDERR, "Error: Failed to generate or verify bcrypt hash.\n");
    exit(1);
}

try {
    $pdo = Database::getConnection();

    $findStmt = $pdo->prepare("SELECT id, role, email FROM users WHERE email = :email LIMIT 1");
    $findStmt->execute([':email' => $targetEmail]);
    $user = $findStmt->fetch();

    if (!$user) {
        fwrite(STDERR, "Error: User '{$targetEmail}' was not found in agrihub_db.users.\n");
        exit(1);
    }

    if ($user['role'] !== 'admin') {
        fwrite(STDERR, "Error: User '{$targetEmail}' has role '{$user['role']}', not 'admin'. Refusing reset.\n");
        exit(1);
    }

    $updateStmt = $pdo->prepare("UPDATE users SET password_hash = :hash WHERE id = :id AND role = 'admin'");
    $updateStmt->execute([
        ':hash' => $hash,
        ':id'   => (int)$user['id']
    ]);

    // Verify persisted hash in database
    $verifyStmt = $pdo->prepare("SELECT password_hash FROM users WHERE id = :id LIMIT 1");
    $verifyStmt->execute([':id' => (int)$user['id']]);
    $storedHash = (string)$verifyStmt->fetchColumn();

    if (!password_verify($newPassword, $storedHash)) {
        fwrite(STDERR, "Error: Post-update password_verify() check failed.\n");
        exit(1);
    }

    // Record audit trail event
    $auditStmt = $pdo->prepare(
        "INSERT INTO audit_logs (user_id, action, ip_address, user_agent, details)
         VALUES (:user_id, 'ADMIN_PASSWORD_RESET_CLI', '127.0.0.1', 'AgriHub Local CLI', :details)"
    );
    $auditStmt->execute([
        ':user_id' => (int)$user['id'],
        ':details' => json_encode(['email' => $targetEmail, 'method' => 'cli_bcrypt_cost_10'])
    ]);

    fwrite(STDOUT, "SUCCESS: Password updated and verified for {$targetEmail} (PASSWORD_BCRYPT, cost=10).\n");

    if ($fixTestUsers) {
        $testEmails = ['farmer@agrihub.local', 'supplier@agrihub.local', 'buyer@agrihub.local'];
        $testStmt = $pdo->prepare("UPDATE users SET password_hash = :hash WHERE email = :email");
        foreach ($testEmails as $testEmail) {
            $testHash = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => 10]);
            $testStmt->execute([':hash' => $testHash, ':email' => $testEmail]);
            fwrite(STDOUT, "Updated seeded test user: {$testEmail}\n");
        }
    }

    fwrite(STDOUT, "\nIMPORTANT SECURITY STEP:\n");
    fwrite(STDOUT, "Delete this temporary script now:\n");
    fwrite(STDOUT, "  del C:\\xampp\\htdocs\\agrihub\\scripts\\reset_admin_password.php\n");
} catch (PDOException $e) {
    fwrite(STDERR, "Database error: " . $e->getMessage() . "\n");
    exit(1);
}
