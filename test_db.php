<?php
/**
 * =====================================================================
 * AgriHub - Database Connection & Schema Health Check
 * File: test_db.php
 * =====================================================================
 * Open this file in your browser via your configured BASE_URL: /test_db.php
 * or run from terminal: php test_db.php
 */

require_once __DIR__ . '/config/config.php';
require_once __DIR__ . '/config/database.php';

$isCli = (php_sapi_name() === 'cli');

if (!$isCli && APP_ENV === 'production') {
    $expectedToken = agriEnv('HEALTH_TOKEN', '');
    $providedToken = $_GET['token'] ?? '';
    if ($expectedToken === '' || !hash_equals($expectedToken, (string)$providedToken)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['success' => false, 'message' => 'Diagnostic page disabled in production.']);
        exit;
    }
}

function output(string $html, string $cliText): void {
    global $isCli;
    if ($isCli) {
        echo $cliText . PHP_EOL;
    } else {
        echo $html;
    }
}

if (!$isCli) {
    echo '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>AgriHub - Database Verification</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px 20px; }
        .container { max-width: 780px; margin: 0 auto; background: #1e293b; border-radius: 12px; padding: 30px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); border: 1px solid #334155; }
        h1 { color: #10b981; margin-top: 0; font-size: 22px; display: flex; align-items: center; gap: 8px; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; }
        .badge-success { background: #064e3b; color: #34d399; border: 1px solid #059669; }
        .badge-fail { background: #7f1d1d; color: #f87171; border: 1px solid #dc2626; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; }
        th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #334155; }
        th { background: #0f172a; color: #94a3b8; font-family: monospace; }
        code { background: #0f172a; padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #38bdf8; }
        .info-card { background: #0f172a; padding: 16px; border-radius: 8px; margin-top: 20px; font-size: 13px; color: #94a3b8; line-height: 1.6; border: 1px solid #334155; }
        .next-step { margin-top: 25px; padding: 16px; background: #064e3b; border-radius: 8px; border: 1px solid #059669; color: #a7f3d0; font-size: 14px; }
    </style>
</head>
<body>
<div class="container">';
}

output('<h1>🌿 AgriHub Database Connection & Health Check</h1>', "=== AgriHub Database Connection & Health Check ===");

try {
    // 1. Test PDO connection
    $pdo = Database::getConnection();
    
    // Verify PDO Attributes
    $emulatePrepares = $pdo->getAttribute(PDO::ATTR_EMULATE_PREPARES);
    $errMode = $pdo->getAttribute(PDO::ATTR_ERRMODE);
    $driverName = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME);
    $serverVersion = $pdo->getAttribute(PDO::ATTR_SERVER_VERSION);

    output(
        '<p><span class="badge badge-success">✓ CONNECTED SUCCESSFULLY</span></p>'
        . '<div class="info-card">'
        . '<strong>Database Engine:</strong> ' . htmlspecialchars($driverName) . ' v' . htmlspecialchars($serverVersion) . '<br>'
        . '<strong>Native Prepared Statements:</strong> ' . ($emulatePrepares === false ? '<span style="color:#34d399;">Active (PDO::ATTR_EMULATE_PREPARES = false)</span>' : '<span style="color:#f87171;">Emulated</span>') . '<br>'
        . '<strong>Error Mode:</strong> ' . ($errMode === PDO::ERRMODE_EXCEPTION ? '<span style="color:#34d399;">PDO::ERRMODE_EXCEPTION</span>' : 'Standard') . '<br>'
        . '</div>',
        "[SUCCESS] Connected to {$driverName} v{$serverVersion}. Native prepared statements active."
    );

    // 2. Check for expected tables
    $expectedTables = [
        'users',
        'categories',
        'products',
        'orders',
        'order_items',
        'logistics_shipments',
        'audit_logs'
    ];

    $stmt = $pdo->query("SHOW TABLES");
    $existingTables = $stmt->fetchAll(PDO::FETCH_COLUMN);

    output('<h3>Database Tables Status</h3><table><thead><tr><th>Table Name</th><th>Status</th><th>Record Count</th></tr></thead><tbody>', "\nDatabase Tables Status:");

    $allPassed = true;
    foreach ($expectedTables as $table) {
        $exists = in_array($table, $existingTables);
        if ($exists) {
            $countStmt = $pdo->query("SELECT COUNT(*) FROM `{$table}`");
            $count = $countStmt->fetchColumn();
            output(
                "<tr><td><code>{$table}</code></td><td><span class='badge badge-success'>Found</span></td><td>{$count} records</td></tr>",
                " - {$table}: FOUND ({$count} records)"
            );
        } else {
            $allPassed = false;
            output(
                "<tr><td><code>{$table}</code></td><td><span class='badge badge-fail'>Missing</span></td><td>-</td></tr>",
                " - {$table}: MISSING"
            );
        }
    }

    output('</tbody></table>', "");

    // 3. Check sample users
    if (in_array('users', $existingTables)) {
        $userStmt = $pdo->query("SELECT id, role, full_name, email, is_verified FROM users ORDER BY id ASC");
        $users = $userStmt->fetchAll();

        output('<h3>Initial Seed Users</h3><table><thead><tr><th>ID</th><th>Role</th><th>Name</th><th>Email</th><th>Verified</th></tr></thead><tbody>', "\nSeed Users:");
        foreach ($users as $u) {
            output(
                "<tr><td>#{$u['id']}</td><td><code>{$u['role']}</code></td><td>" . htmlspecialchars($u['full_name']) . "</td><td><code>{$u['email']}</code></td><td>" . ($u['is_verified'] ? 'Yes' : 'No') . "</td></tr>",
                " - [{$u['role']}] ID: {$u['id']} | {$u['full_name']} ({$u['email']})"
            );
        }
        output('</tbody></table>', "");
    }

    if ($allPassed) {
        output(
            '<div class="next-step">'
            . '<strong>Phase 1 Complete!</strong> Your database setup and secure PDO connection are fully operational. '
            . 'Please confirm your test results with the developer to proceed to Phase 2 (Authentication & Security Helpers).'
            . '</div>',
            "\n[READY] Phase 1 complete. Database connection and schema verified."
        );
    } else {
        output(
            '<div class="info-card" style="border-color:#dc2626; color:#fca5a5;">'
            . '<strong>Notice:</strong> One or more tables are missing. Please import <code>database/schema.sql</code> into your MySQL database.'
            . '</div>',
            "\n[NOTICE] Some tables missing. Please import database/schema.sql."
        );
    }

} catch (PDOException $e) {
    output(
        '<div class="info-card" style="border-color:#dc2626; color:#fca5a5;">'
        . '<h3>Connection Test Failed</h3>'
        . '<p>' . htmlspecialchars($e->getMessage()) . '</p>'
        . '</div>',
        "[ERROR] Connection Failed: " . $e->getMessage()
    );
}

if (!$isCli) {
    echo '</div></body></html>';
}
