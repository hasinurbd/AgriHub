<?php
/**
 * =====================================================================
 * AgriHub - API Response Helper & Security Middleware
 * File: helpers/response.php
 * =====================================================================
 * Handles:
 * - CORS headers for React Vite frontend development
 * - Secure session initialization
 * - Standardized JSON response formatting
 * - Authentication & Role authorization guards
 * - Centralized Audit Logging
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../config/database.php';

// 1. Strict CORS Allowlist & JSON Response Headers
// Allow explicitly configured frontend origins & Vercel preview URLs when credentials are enabled.
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$isAllowedOrigin = $requestOrigin !== '' && isOriginAllowed($requestOrigin);

header("Vary: Origin");
header("Content-Type: application/json; charset=UTF-8");

if ($isAllowedOrigin) {
    header("Access-Control-Allow-Origin: {$requestOrigin}");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-Idempotency-Key");
    header("Access-Control-Max-Age: 86400");
}

// Handle HTTP preflight OPTIONS requests immediately
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if ($requestOrigin !== '' && !$isAllowedOrigin) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Origin not allowed by CORS policy.',
            'data'    => null
        ]);
        exit;
    }
    http_response_code(204);
    exit;
}

// 2. Initialize Secure Session
startSecureSession();

/**
 * Standardized JSON response emitter
 *
 * @param bool $success Whether the operation succeeded
 * @param mixed $data Payload to return
 * @param string $message User-friendly status message
 * @param int $statusCode HTTP status code (200, 400, 401, 403, 404, 500)
 */
function sendJsonResponse(bool $success, $data = null, string $message = '', int $statusCode = 200): void {
    http_response_code($statusCode);
    echo json_encode([
        'success'   => $success,
        'message'   => $message,
        'data'      => $data,
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Read and decode incoming JSON request body
 *
 * @return array
 */
function getJsonInput(): array {
    $raw = file_get_contents('php://input');
    if (empty($raw)) {
        return $_POST; // Fallback to form-data if sent that way
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

/**
 * Clear server session data and expire the browser session cookie
 */
function destroyAuthSession(): void {
    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires'  => time() - 42000,
            'path'     => $params['path'] ?? '/',
            'domain'   => $params['domain'] ?? '',
            'secure'   => (bool)($params['secure'] ?? false),
            'httponly' => (bool)($params['httponly'] ?? true),
            'samesite' => $params['samesite'] ?? 'Lax'
        ]);
    }

    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}

/**
 * Get current authenticated user session data
 *
 * @return array|null
 */
function getAuthUser(): ?array {
    if (!empty($_SESSION['user_id'])) {
        return [
            'id'            => (int)$_SESSION['user_id'],
            'role'          => $_SESSION['role'] ?? 'buyer',
            'full_name'     => $_SESSION['full_name'] ?? '',
            'email'         => $_SESSION['email'] ?? '',
            'business_name' => $_SESSION['business_name'] ?? null,
            'is_verified'   => (bool)($_SESSION['is_verified'] ?? false)
        ];
    }
    return null;
}

/**
 * Enforce that a request is authenticated and synchronize role/identity from MySQL
 *
 * @return array Authenticated user array
 */
function requireAuth(): array {
    $sessionUser = getAuthUser();
    if (!$sessionUser) {
        sendJsonResponse(false, null, 'Authentication required. Please log in.', 401);
    }

    try {
        $pdo = Database::getConnection();
        $stmt = $pdo->prepare(
            "SELECT id, role, full_name, email, business_name, is_verified
             FROM users
             WHERE id = :id
             LIMIT 1"
        );
        $stmt->execute([':id' => $sessionUser['id']]);
        $dbUser = $stmt->fetch();

        if (!$dbUser) {
            destroyAuthSession();
            sendJsonResponse(false, null, 'Session is no longer valid. Please log in again.', 401);
        }

        // Keep session synchronized with authoritative database role & status
        $_SESSION['user_id']       = (int)$dbUser['id'];
        $_SESSION['role']          = $dbUser['role'];
        $_SESSION['full_name']     = $dbUser['full_name'];
        $_SESSION['email']         = $dbUser['email'];
        $_SESSION['business_name'] = $dbUser['business_name'];
        $_SESSION['is_verified']   = (bool)$dbUser['is_verified'];

        return [
            'id'            => (int)$dbUser['id'],
            'role'          => $dbUser['role'],
            'full_name'     => $dbUser['full_name'],
            'email'         => $dbUser['email'],
            'business_name' => $dbUser['business_name'],
            'is_verified'   => (bool)$dbUser['is_verified']
        ];
    } catch (PDOException $e) {
        error_log("Session verification error: " . $e->getMessage());
        sendJsonResponse(false, null, 'Unable to verify session.', 500);
    }
}

/**
 * Enforce Role-Based Access Control (RBAC)
 *
 * @param array|string $allowedRoles Single role or array of allowed roles
 * @return array Authenticated user array
 */
function requireRole($allowedRoles): array {
    $user = requireAuth();
    $roles = is_array($allowedRoles) ? $allowedRoles : [$allowedRoles];
    if (!in_array($user['role'], $roles, true)) {
        sendJsonResponse(false, null, "Access denied. Required role: " . implode(' or ', $roles), 403);
    }
    return $user;
}

/**
 * Write a security or business event into audit_logs table
 *
 * @param PDO $pdo Active PDO instance
 * @param int|null $userId
 * @param string $action Action key (e.g. USER_LOGIN, ORDER_CREATED)
 * @param array $details Context details
 */
function recordAuditLog(PDO $pdo, ?int $userId, string $action, array $details = []): void {
    try {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $agent = substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 0, 255);
        $jsonDetails = json_encode($details);

        $stmt = $pdo->prepare("INSERT INTO audit_logs (user_id, action, ip_address, user_agent, details) 
                               VALUES (:user_id, :action, :ip, :agent, :details)");
        $stmt->execute([
            ':user_id' => $userId,
            ':action'  => $action,
            ':ip'      => $ip,
            ':agent'   => $agent,
            ':details' => $jsonDetails
        ]);
    } catch (Exception $e) {
        // Never let audit failure crash the primary business operation; log to server
        error_log("Failed to write audit log: " . $e->getMessage());
    }
}
