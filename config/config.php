<?php
/**
 * =====================================================================
 * AgriHub - Application Configuration, Environment & Session Security
 * File: config/config.php
 * =====================================================================
 */

if (!defined('AGRIHUB_APP')) {
    define('AGRIHUB_APP', true);
}

/**
 * Lightweight zero-dependency .env loader for PHP deployments
 * (Hostinger, Render, Railway, Docker, or local Apache/Nginx).
 */
function loadAgriHubEnv(string $envPath): void {
    if (!is_file($envPath) || !is_readable($envPath)) {
        return;
    }

    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!is_array($lines)) {
        return;
    }

    foreach ($lines as $line) {
        $trimmed = trim($line);
        if ($trimmed === '' || strpos($trimmed, '#') === 0 || strpos($trimmed, '=') === false) {
            continue;
        }

        [$key, $val] = explode('=', $trimmed, 2);
        $key = trim($key);
        $val = trim($val);

        if ($key === '') {
            continue;
        }

        // Strip matching single or double quotes
        if (
            (substr($val, 0, 1) === '"' && substr($val, -1) === '"') ||
            (substr($val, 0, 1) === "'" && substr($val, -1) === "'")
        ) {
            $val = substr($val, 1, -1);
        }

        if (getenv($key) === false && !array_key_exists($key, $_ENV)) {
            putenv("{$key}={$val}");
            $_ENV[$key] = $val;
            $_SERVER[$key] = $val;
        }
    }
}

loadAgriHubEnv(dirname(__DIR__) . '/.env');

function agriEnv(string $key, ?string $default = null): ?string {
    $val = getenv($key);
    if ($val !== false && $val !== '') {
        return $val;
    }
    if (isset($_ENV[$key]) && $_ENV[$key] !== '') {
        return (string)$_ENV[$key];
    }
    if (isset($_SERVER[$key]) && $_SERVER[$key] !== '') {
        return (string)$_SERVER[$key];
    }
    return $default;
}

function agriEnvBool(string $key, bool $default = false): bool {
    $raw = agriEnv($key);
    if ($raw === null) {
        return $default;
    }
    return in_array(strtolower(trim($raw)), ['1', 'true', 'yes', 'on'], true);
}

/**
 * Detect HTTPS accurately behind reverse proxies (Render, Railway, Cloudflare, Vercel)
 */
function isHttpsRequest(): bool {
    if (!empty($_SERVER['HTTPS']) && strtolower((string)$_SERVER['HTTPS']) !== 'off') {
        return true;
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
        $proto = strtolower(trim(explode(',', (string)$_SERVER['HTTP_X_FORWARDED_PROTO'])[0]));
        if ($proto === 'https') {
            return true;
        }
    }
    if (!empty($_SERVER['HTTP_X_FORWARDED_SSL']) && strtolower((string)$_SERVER['HTTP_X_FORWARDED_SSL']) === 'on') {
        return true;
    }
    if (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) {
        return true;
    }
    return false;
}

// 1. Application Constants
define('APP_NAME', 'AgriHub');
define('APP_VERSION', '1.1.0');
define('APP_TIMEZONE', agriEnv('APP_TIMEZONE', 'UTC') ?: 'UTC');
define('APP_ENV', strtolower(agriEnv('APP_ENV', 'development') ?: 'development'));

date_default_timezone_set(APP_TIMEZONE);

// 2. Base URL Detection (prefers APP_URL env var, falls back to forwarded host)
$configuredAppUrl = agriEnv('APP_URL');
if ($configuredAppUrl && preg_match('#^https?://#i', $configuredAppUrl)) {
    define('BASE_URL', rtrim($configuredAppUrl, '/'));
} else {
    $protocol = isHttpsRequest() ? 'https://' : 'http://';
    $host = $_SERVER['HTTP_X_FORWARDED_HOST'] ?? $_SERVER['HTTP_HOST'] ?? 'localhost';
    $scriptDir = dirname($_SERVER['SCRIPT_NAME'] ?? '');
    $scriptDir = str_replace('\\', '/', $scriptDir);
    $baseDir = rtrim(preg_replace('#/(config|api|auth|farmer|supplier|buyer|admin|helpers|scripts).*#', '', $scriptDir), '/');
    define('BASE_URL', rtrim($protocol . $host . $baseDir, '/'));
}

// 3. User Roles
define('ROLE_ADMIN', 'admin');
define('ROLE_FARMER', 'farmer');
define('ROLE_SUPPLIER', 'supplier');
define('ROLE_BUYER', 'buyer');

// 4. Environment-Driven CORS Allowlist
// Never use wildcard '*' when Access-Control-Allow-Credentials is enabled.
$corsOrigins = [];

$envCorsList = agriEnv('CORS_ALLOWED_ORIGINS', '');
if ($envCorsList !== null && $envCorsList !== '') {
    foreach (explode(',', $envCorsList) as $originItem) {
        $cleaned = rtrim(trim($originItem), '/');
        if ($cleaned !== '' && preg_match('#^https?://#i', $cleaned)) {
            $corsOrigins[] = $cleaned;
        }
    }
}

$frontendUrl = agriEnv('FRONTEND_URL', '');
if ($frontendUrl !== null && $frontendUrl !== '') {
    $cleanedFrontend = rtrim(trim($frontendUrl), '/');
    if (preg_match('#^https?://#i', $cleanedFrontend)) {
        $corsOrigins[] = $cleanedFrontend;
    }
}

// Include local development origins only outside strict production (or if explicitly listed above)
if (APP_ENV !== 'production') {
    $corsOrigins = array_merge($corsOrigins, [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost',
        'http://127.0.0.1'
    ]);
}

define('ALLOWED_CORS_ORIGINS', array_values(array_unique($corsOrigins)));
define('ALLOW_VERCEL_PREVIEW_ORIGINS', agriEnvBool('ALLOW_VERCEL_PREVIEW_ORIGINS', true));

function isOriginAllowed(string $origin): bool {
    $normalized = rtrim(trim($origin), '/');
    if ($normalized === '') {
        return false;
    }
    if (in_array($normalized, ALLOWED_CORS_ORIGINS, true)) {
        return true;
    }
    if (
        ALLOW_VERCEL_PREVIEW_ORIGINS &&
        preg_match('#^https://[a-z0-9.-]+\.(vercel\.app|netlify\.app|pages\.dev|onrender\.com|up\.railway\.app|github\.io|web\.app|firebaseapp\.com|surge\.sh)$#i', $normalized)
    ) {
        return true;
    }
    return false;
}

/**
 * Configure and start a hardened PHP session.
 * Automatically switches to SameSite=None; Secure on HTTPS deployments so
 * Vercel frontend -> Render/Railway/Hostinger API cookies work cross-origin.
 */
function startSecureSession(): void {
    if (session_status() === PHP_SESSION_NONE) {
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');

        $isHttps = isHttpsRequest();
        $secureCookie = agriEnvBool('SESSION_SECURE', $isHttps || APP_ENV === 'production');
        $sameSite = agriEnv('SESSION_SAMESITE', $secureCookie ? 'None' : 'Lax') ?: 'Lax';

        // Browsers reject SameSite=None unless Secure=true
        if (strcasecmp($sameSite, 'None') === 0 && !$secureCookie) {
            $sameSite = 'Lax';
        }

        $cookieParams = [
            'lifetime' => 0,
            'path'     => '/',
            'domain'   => agriEnv('SESSION_DOMAIN', '') ?: '',
            'secure'   => $secureCookie,
            'httponly' => true,
            'samesite' => $sameSite
        ];

        session_set_cookie_params($cookieParams);
        session_start();
    }
}
