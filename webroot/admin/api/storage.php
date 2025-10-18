<?php
// Gemeinsame Helfer für Dateipfade und JSON-Zugriff
// Stellt zentrale Funktionen bereit, damit Pfade nicht hart codiert werden
// und Deployments mit abweichenden Wurzelverzeichnissen funktionieren.

declare(strict_types=1);

const SIGNAGE_JSON_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT;

/**
 * Determine whether JSON fallback files should be written to disk.
 */
function signage_json_fallback_enabled(): bool
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }

    $raw = getenv('SIGNAGE_JSON_FALLBACK');
    if ($raw === false && isset($_ENV['SIGNAGE_JSON_FALLBACK'])) {
        $raw = (string) $_ENV['SIGNAGE_JSON_FALLBACK'];
    }
    if ($raw === false && isset($_SERVER['SIGNAGE_JSON_FALLBACK'])) {
        $raw = (string) $_SERVER['SIGNAGE_JSON_FALLBACK'];
    }

    if ($raw === false || $raw === null || $raw === '') {
        return $cached = true;
    }

    $value = strtolower(trim((string) $raw));
    return $cached = !in_array($value, ['0', 'false', 'no', 'off'], true);
}

/**
 * Resolve a fallback JSON file path. Allows overriding devices.json via DEVICES_PATH.
 */
function signage_resolve_json_path(string $file): string
{
    $basename = basename($file);
    if ($basename === 'devices.json') {
        $custom = getenv('DEVICES_PATH');
        if ($custom === false && isset($_ENV['DEVICES_PATH'])) {
            $custom = (string) $_ENV['DEVICES_PATH'];
        }
        if ($custom === false && isset($_SERVER['DEVICES_PATH'])) {
            $custom = (string) $_SERVER['DEVICES_PATH'];
        }
        if ($custom !== false && is_string($custom) && $custom !== '') {
            return $custom;
        }
    }

    return signage_data_path($file);
}

/**
 * Return the DSN/user/pass triple for the signage database connection.
 */
function signage_db_config(): array
{
    $dsn = getenv('SIGNAGE_DB_DSN');
    if ($dsn === false && isset($_ENV['SIGNAGE_DB_DSN'])) {
        $dsn = (string) $_ENV['SIGNAGE_DB_DSN'];
    }
    if ($dsn === false && isset($_SERVER['SIGNAGE_DB_DSN'])) {
        $dsn = (string) $_SERVER['SIGNAGE_DB_DSN'];
    }

    $dsn = ($dsn !== false) ? trim((string) $dsn) : '';

    if ($dsn === '') {
        $sqlitePath = signage_data_path('signage.sqlite');
        $dir = dirname($sqlitePath);
        if (!is_dir($dir)) {
            @mkdir($dir, 02775, true);
        }
        $dsn = 'sqlite:' . $sqlitePath;
    }

    $user = getenv('SIGNAGE_DB_USER');
    if ($user === false && isset($_ENV['SIGNAGE_DB_USER'])) {
        $user = (string) $_ENV['SIGNAGE_DB_USER'];
    }
    if ($user === false && isset($_SERVER['SIGNAGE_DB_USER'])) {
        $user = (string) $_SERVER['SIGNAGE_DB_USER'];
    }
    $user = ($user !== false) ? (string) $user : null;

    $pass = getenv('SIGNAGE_DB_PASS');
    if ($pass === false && isset($_ENV['SIGNAGE_DB_PASS'])) {
        $pass = (string) $_ENV['SIGNAGE_DB_PASS'];
    }
    if ($pass === false && isset($_SERVER['SIGNAGE_DB_PASS'])) {
        $pass = (string) $_SERVER['SIGNAGE_DB_PASS'];
    }
    $pass = ($pass !== false) ? (string) $pass : null;

    return [$dsn, $user, $pass];
}

/**
 * Lazily open a PDO connection. Returns null if connection fails.
 */
function signage_db(): ?PDO
{
    static $pdo = null;
    static $failed = false;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    if ($failed) {
        return null;
    }

    [$dsn, $user, $pass] = signage_db_config();

    try {
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ];

        $pdo = new PDO($dsn, $user, $pass, $options);

        if (str_starts_with($dsn, 'sqlite:')) {
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->exec('PRAGMA journal_mode = WAL');
        }

        signage_db_initialize($pdo);
    } catch (Throwable $e) {
        error_log('[signage] database connection failed: ' . $e->getMessage());
        $failed = true;
        return null;
    }

    return $pdo;
}

/**
 * Run one-time schema migrations.
 */
function signage_db_initialize(PDO $pdo): void
{
    static $initialized = false;
    if ($initialized) {
        return;
    }

    $pdo->exec('CREATE TABLE IF NOT EXISTS signage_documents (
        name VARCHAR(190) PRIMARY KEY,
        body TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        checksum VARCHAR(64) NULL
    )');

    $initialized = true;
}

/**
 * Normalize file names to database keys.
 */
function signage_document_key(string $file): string
{
    $normalized = str_replace('\\', '/', trim($file));
    if ($normalized === '') {
        $normalized = 'document';
    }
    if ($normalized[0] === '/') {
        $normalized = ltrim($normalized, '/');
    }
    return 'file:' . strtolower($normalized);
}

function signage_db_fetch_document(PDO $pdo, string $name): ?string
{
    $stmt = $pdo->prepare('SELECT body FROM signage_documents WHERE name = :name LIMIT 1');
    $stmt->execute(['name' => $name]);
    $value = $stmt->fetchColumn();
    if ($value === false) {
        return null;
    }
    return (string) $value;
}

function signage_db_store_document(PDO $pdo, string $name, string $body, int $timestamp): void
{
    $checksum = hash('sha256', $body);
    $update = $pdo->prepare('UPDATE signage_documents SET body = :body, updated_at = :updated_at, checksum = :checksum WHERE name = :name');
    $update->execute([
        'body' => $body,
        'updated_at' => $timestamp,
        'checksum' => $checksum,
        'name' => $name,
    ]);

    if ($update->rowCount() > 0) {
        return;
    }

    $insert = $pdo->prepare('INSERT INTO signage_documents (name, body, updated_at, checksum) VALUES (:name, :body, :updated_at, :checksum)');
    $insert->execute([
        'name' => $name,
        'body' => $body,
        'updated_at' => $timestamp,
        'checksum' => $checksum,
    ]);
}

function signage_default_schedule(): array
{
    return [
        'version' => 1,
        'saunas' => [],
        'rows' => [],
        'meta' => [],
    ];
}

function signage_normalize_schedule($schedule): array
{
    if (!is_array($schedule)) {
        $schedule = [];
    }

    if (!isset($schedule['saunas']) || !is_array($schedule['saunas'])) {
        $schedule['saunas'] = [];
    }

    if (!isset($schedule['rows']) || !is_array($schedule['rows'])) {
        $schedule['rows'] = [];
    }

    if (!isset($schedule['meta']) || !is_array($schedule['meta'])) {
        $schedule['meta'] = [];
    }

    $schedule['version'] = (int) ($schedule['version'] ?? 1);

    return $schedule;
}

function signage_base_path(): string
{
    static $base = null;
    if ($base !== null) {
        return $base;
    }

    $candidates = [
        getenv('SIGNAGE_BASE_PATH') ?: null,
        $_ENV['SIGNAGE_BASE_PATH'] ?? null,
        $_SERVER['SIGNAGE_BASE_PATH'] ?? null,
        realpath(__DIR__ . '/../../') ?: (__DIR__ . '/../../'),
        $_SERVER['DOCUMENT_ROOT'] ?? null,
    ];

    foreach ($candidates as $candidate) {
        if (!is_string($candidate) || $candidate === '') {
            continue;
        }
        $resolved = realpath($candidate);
        if ($resolved !== false) {
            $candidate = $resolved;
        }
        if (!is_dir($candidate)) {
            continue;
        }

        $baseDir = rtrim($candidate, '/');
        if (is_dir($baseDir . '/data')) {
            return $base = $baseDir;
        }

        if (substr($baseDir, -6) === '/admin') {
            $parent = rtrim(dirname($baseDir), '/');
            if ($parent !== '' && is_dir($parent . '/data')) {
                return $base = $parent;
            }
        }
    }

    $fallback = realpath(__DIR__ . '/../../');
    if ($fallback === false) {
        $fallback = __DIR__ . '/../../';
    }

    return $base = rtrim($fallback, '/');
}

function signage_data_path(string $file = ''): string
{
    $dir = signage_base_path() . '/data';
    if ($file === '') {
        return $dir;
    }
    return $dir . '/' . ltrim($file, '/');
}

function signage_assets_path(string $path = ''): string
{
    $dir = signage_base_path() . '/assets';
    if ($path === '') {
        return $dir;
    }
    return $dir . '/' . ltrim($path, '/');
}

function signage_has_json(string $file): bool
{
    $pdo = signage_db();
    if ($pdo instanceof PDO) {
        try {
            $stmt = $pdo->prepare('SELECT 1 FROM signage_documents WHERE name = :name');
            $stmt->execute(['name' => signage_document_key($file)]);
            if ($stmt->fetchColumn() !== false) {
                return true;
            }
        } catch (Throwable $e) {
            error_log('[signage] query failed: ' . $e->getMessage());
        }
    }

    $path = signage_resolve_json_path($file);
    return is_file($path);
}

function signage_read_json(string $file, array $default = []): array
{
    $pdo = signage_db();
    if ($pdo instanceof PDO) {
        try {
            $raw = signage_db_fetch_document($pdo, signage_document_key($file));
            if ($raw !== null && $raw !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    return $decoded;
                }
            }
        } catch (Throwable $e) {
            error_log('[signage] read document failed: ' . $e->getMessage());
        }
    }

    $path = signage_resolve_json_path($file);
    if (!is_file($path)) {
        return $default;
    }
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') {
        return $default;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $default;
}

function signage_write_json_to_file(string $file, string $json, ?string &$error = null): bool
{
    $path = signage_resolve_json_path($file);
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 02775, true) && !is_dir($dir)) {
        $error = 'unable to create directory: ' . $dir;
        return false;
    }
    $bytes = @file_put_contents($path, $json, LOCK_EX);
    if ($bytes === false) {
        $err = error_get_last();
        $error = $err['message'] ?? 'file_put_contents failed';
        return false;
    }
    @chmod($path, 0644);
    return true;
}

function signage_write_json_fallback(string $file, $data, ?string &$error = null): bool
{
    $json = json_encode($data, SIGNAGE_JSON_FLAGS);
    if ($json === false) {
        $error = 'json_encode failed: ' . json_last_error_msg();
        return false;
    }
    return signage_write_json_to_file($file, $json, $error);
}

function signage_write_json(string $file, $data, ?string &$error = null): bool
{
    $json = json_encode($data, SIGNAGE_JSON_FLAGS);
    if ($json === false) {
        $error = 'json_encode failed: ' . json_last_error_msg();
        return false;
    }

    $pdo = signage_db();
    if (!($pdo instanceof PDO)) {
        $error = 'database connection unavailable';
        return false;
    }

    try {
        signage_db_store_document($pdo, signage_document_key($file), $json, time());
    } catch (Throwable $e) {
        $error = 'database write failed: ' . $e->getMessage();
        return false;
    }

    if (signage_json_fallback_enabled()) {
        $fallbackError = null;
        if (!signage_write_json_to_file($file, $json, $fallbackError)) {
            error_log('[signage] unable to write fallback for ' . $file . ': ' . ($fallbackError ?? 'unknown'));
        }
    }

    return true;
}

function signage_absolute_path(string $relative): string
{
    if ($relative === '' || $relative[0] !== '/') {
        $relative = '/' . ltrim($relative, '/');
    }
    return signage_base_path() . $relative;
}

