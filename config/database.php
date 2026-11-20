<?php
/**
 * =====================================================================
 * AgriHub - Agriculture Supply Chain Management System
 * Database Connection Handler (PDO Singleton)
 * File: config/database.php
 * =====================================================================
 * Supports:
 * - Standard env vars: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS
 * - Railway / Cloud MySQL vars: MYSQLHOST, MYSQLPORT, MYSQLDATABASE, MYSQLUSER, MYSQLPASSWORD
 * - DSN strings: DATABASE_URL or MYSQL_URL (mysql://user:pass@host:port/db)
 */

if (!defined('AGRIHUB_APP')) {
    define('AGRIHUB_APP', true);
}

require_once __DIR__ . '/config.php';

class Database {
    private static ?PDO $instance = null;

    // Development-only fallbacks (production requires env vars or DATABASE_URL)
    private const DEV_DB_HOST = '127.0.0.1';
    private const DEV_DB_PORT = '3306';
    private const DEV_DB_NAME = 'agrihub_db';
    private const DEV_DB_USER = 'root';
    private const DEV_DB_PASS = '';
    private const DB_CHARSET  = 'utf8mb4';

    private function __construct() {}
    private function __clone() {}

    /**
     * Resolve MySQL connection parameters from environment variables or DSN URL.
     */
    private static function resolveConfig(): array {
        $dsnUrl = agriEnv('DATABASE_URL') ?: agriEnv('MYSQL_URL');
        if ($dsnUrl) {
            $parsed = parse_url($dsnUrl);
            if (is_array($parsed) && !empty($parsed['host'])) {
                return [
                    'host' => (string)$parsed['host'],
                    'port' => isset($parsed['port']) ? (string)$parsed['port'] : '3306',
                    'name' => isset($parsed['path']) ? ltrim((string)$parsed['path'], '/') : self::DEV_DB_NAME,
                    'user' => isset($parsed['user']) ? urldecode((string)$parsed['user']) : self::DEV_DB_USER,
                    'pass' => isset($parsed['pass']) ? urldecode((string)$parsed['pass']) : ''
                ];
            }
        }

        $isProd = defined('APP_ENV') && APP_ENV === 'production';

        return [
            'host' => agriEnv('DB_HOST') ?: agriEnv('MYSQLHOST') ?: ($isProd ? '' : self::DEV_DB_HOST),
            'port' => agriEnv('DB_PORT') ?: agriEnv('MYSQLPORT') ?: self::DEV_DB_PORT,
            'name' => agriEnv('DB_NAME') ?: agriEnv('MYSQLDATABASE') ?: ($isProd ? '' : self::DEV_DB_NAME),
            'user' => agriEnv('DB_USER') ?: agriEnv('MYSQLUSER') ?: ($isProd ? '' : self::DEV_DB_USER),
            'pass' => agriEnv('DB_PASS') ?? agriEnv('MYSQLPASSWORD') ?? ($isProd ? '' : self::DEV_DB_PASS)
        ];
    }

    /**
     * Get the single active PDO connection instance.
     * Throws PDOException cleanly on failure so API endpoints return JSON (never raw HTML).
     *
     * @return PDO Active PDO database connection
     * @throws PDOException if connection fails or config is incomplete
     */
    public static function getConnection(): PDO {
        if (self::$instance === null) {
            $cfg = self::resolveConfig();

            if ($cfg['host'] === '' || $cfg['name'] === '' || $cfg['user'] === '') {
                throw new PDOException('Database environment configuration is incomplete (DB_HOST, DB_NAME, DB_USER).');
            }

            $charset = self::DB_CHARSET;
            $dsn = "mysql:host={$cfg['host']};port={$cfg['port']};dbname={$cfg['name']};charset={$charset}";

            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
            ];

            // Optional SSL CA path for managed MySQL providers (PlanetScale, Aiven, Railway, TiDB)
            $sslCa = agriEnv('DB_SSL_CA');
            if ($sslCa && is_file($sslCa) && defined('PDO::MYSQL_ATTR_SSL_CA')) {
                $options[PDO::MYSQL_ATTR_SSL_CA] = $sslCa;
            }

            try {
                self::$instance = new PDO($dsn, $cfg['user'], $cfg['pass'], $options);
            } catch (PDOException $e) {
                error_log('AgriHub Database Connection Failed: ' . $e->getMessage());
                throw $e;
            }
        }

        return self::$instance;
    }
}
