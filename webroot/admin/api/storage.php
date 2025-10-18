<?php
// Gemeinsame Helfer für Dateipfade und JSON-Zugriff
// Stellt zentrale Funktionen bereit, damit Pfade nicht hart codiert werden
// und Deployments mit abweichenden Wurzelverzeichnissen funktionieren.

declare(strict_types=1);

require_once __DIR__ . '/db.php';

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
function signage_db_path(): string
{
    $custom = getenv('SIGNAGE_DB_PATH');
    if (is_string($custom) && $custom !== '') {
        return $custom;
    }
    if (!empty($_ENV['SIGNAGE_DB_PATH'])) {
        return (string) $_ENV['SIGNAGE_DB_PATH'];
    }
    if (!empty($_SERVER['SIGNAGE_DB_PATH'])) {
        return (string) $_SERVER['SIGNAGE_DB_PATH'];
    }
    return signage_data_path('signage.db');
}

function signage_db_available(): bool
{
    static $available;
    if ($available !== null) {
        return $available;
    }
    if (!class_exists('\\PDO')) {
        return $available = false;
    }
    try {
        $drivers = \PDO::getAvailableDrivers();
    } catch (Throwable $exception) {
        error_log('PDO drivers unavailable: ' . $exception->getMessage());
        return $available = false;
    }
    if (!in_array('sqlite', $drivers, true)) {
        return $available = false;
    }
    if (!extension_loaded('pdo_sqlite') && !extension_loaded('sqlite3')) {
        return $available = false;
    }
    return $available = true;
}

function signage_db(): \PDO
{
    static $pdo = null;
    if ($pdo instanceof \PDO) {
        return $pdo;
    }
    if (!signage_db_available()) {
        throw new RuntimeException('SQLite support is not available.');
    }

    $path = signage_db_path();
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 02775, true) && !is_dir($dir)) {
        throw new RuntimeException('Unable to create SQLite directory: ' . $dir);
    }

    try {
        $pdo = new \PDO('sqlite:' . $path, null, null, [
            \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
            \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
            \PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (Throwable $exception) {
        throw new RuntimeException('Unable to open SQLite database: ' . $exception->getMessage(), 0, $exception);
    }

    try {
        $pdo->exec('PRAGMA foreign_keys = ON');
    } catch (Throwable $exception) {
        error_log('Unable to enable SQLite foreign_keys pragma: ' . $exception->getMessage());
    }

    $pathExists = @file_exists($path);
    if ($pathExists) {
        @chmod($path, 0660);
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
function signage_db_bootstrap(): void
{
    static $bootstrapped = false;
    if ($bootstrapped) {
        return;
    }
    $pdo = signage_db();
    $queries = [
        'CREATE TABLE IF NOT EXISTS kv_store (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at INTEGER NOT NULL DEFAULT (strftime(\'%s\', \'now\'))
        )',
        'CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event TEXT NOT NULL,
            username TEXT,
            context TEXT,
            created_at INTEGER NOT NULL DEFAULT (strftime(\'%s\', \'now\'))
        )',
    ];
    try {
        foreach ($queries as $sql) {
            $pdo->exec($sql);
        }
    } catch (Throwable $exception) {
        throw new RuntimeException('Failed to initialize SQLite schema: ' . $exception->getMessage(), 0, $exception);
    }
    $bootstrapped = true;
}

function signage_kv_get(string $key, mixed $default = null): mixed
{
    try {
        signage_db_bootstrap();
        $pdo = signage_db();
    } catch (Throwable $exception) {
        throw new RuntimeException('Unable to access SQLite store: ' . $exception->getMessage(), 0, $exception);
    }

    try {
        $stmt = $pdo->prepare('SELECT value FROM kv_store WHERE key = :key LIMIT 1');
        $stmt->execute([':key' => $key]);
        $value = $stmt->fetchColumn();
    } catch (Throwable $exception) {
        throw new RuntimeException('Failed to load SQLite value: ' . $exception->getMessage(), 0, $exception);
    }

    if ($value === false || $value === null) {
        return $default;
    }

    $decoded = json_decode((string) $value, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log('SQLite JSON decode error for key ' . $key . ': ' . json_last_error_msg());
        return $default;
    }

    return $decoded;
}

function signage_kv_set(string $key, mixed $value): void
{
    try {
        signage_db_bootstrap();
        $pdo = signage_db();
    } catch (Throwable $exception) {
        throw new RuntimeException('Unable to access SQLite store: ' . $exception->getMessage(), 0, $exception);
    }

    $json = json_encode($value, SIGNAGE_JSON_FLAGS);
    if ($json === false) {
        throw new RuntimeException('json_encode failed: ' . json_last_error_msg());
    }

    $ts = time();
    try {
        $stmt = $pdo->prepare('INSERT INTO kv_store(key, value, updated_at) VALUES (:key, :value, :updated)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at');
        $stmt->execute([
            ':key' => $key,
            ':value' => $json,
            ':updated' => $ts,
        ]);
    } catch (Throwable $exception) {
        throw new RuntimeException('Failed to persist SQLite value: ' . $exception->getMessage(), 0, $exception);
    }
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
    $normalized = strtolower(trim($file));
    if ($normalized === 'settings.json') {
        return signage_read_settings_from_db($default);
    }
    if ($normalized === 'schedule.json') {
        return signage_read_schedule_from_db($default);
    }

    return signage_read_json_file($file, $default);
}

function signage_write_json(string $file, $data, ?string &$error = null): bool
{
    $normalized = strtolower(trim($file));
    if ($normalized === 'settings.json') {
        return signage_write_settings_to_db(is_array($data) ? $data : [], $error);
    }
    if ($normalized === 'schedule.json') {
        $schedule = is_array($data) ? $data : [];
        return signage_write_schedule_to_db($schedule, $error);
    }

    return signage_write_json_file($file, $data, $error);
}

function signage_read_json_file(string $file, array $default = []): array
{
    $path = signage_data_path($file);
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
function signage_write_json_file(string $file, $data, ?string &$error = null): bool
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
function signage_read_settings_from_db(array $default = []): array
{
    try {
        $pdo = signage_db();
    } catch (Throwable $e) {
        return $default;
    }
    $stmt = $pdo->prepare('SELECT payload_json FROM settings WHERE key = :key LIMIT 1');
    $stmt->execute([':key' => 'app_settings']);
    $json = $stmt->fetchColumn();
    if ($json === false || $json === null || $json === '') {
        return $default;
    }
    $decoded = json_decode((string) $json, true);
    return is_array($decoded) ? $decoded : $default;
}

function signage_write_settings_to_db(array $settings, ?string &$error = null): bool
{
    try {
        $pdo = signage_db();
    } catch (Throwable $e) {
        $error = $e->getMessage();
        return false;
    }

    $payload = json_encode($settings, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($payload === false) {
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
    try {
        $stmt = $pdo->prepare('INSERT OR REPLACE INTO settings (key, payload_json) VALUES (:key, :payload)');
        $stmt->execute([
            ':key' => 'app_settings',
            ':payload' => $payload,
        ]);
    } catch (Throwable $e) {
        $error = $e->getMessage();
        return false;
    }

    return signage_write_json_file('settings.json', $settings, $error);
}

function signage_read_schedule_from_db(array $default = []): array
{
    try {
        $pdo = signage_db();
    } catch (Throwable $e) {
        return signage_normalize_schedule($default);
    }

    $stmt = $pdo->prepare('SELECT payload_json FROM settings WHERE key = :key LIMIT 1');
    $stmt->execute([':key' => 'schedule_full']);
    $json = $stmt->fetchColumn();
    if ($json !== false && $json !== null && $json !== '') {
        $decoded = json_decode((string) $json, true);
        if (is_array($decoded)) {
            return signage_normalize_schedule($decoded);
        }
    }

    $schedule = signage_normalize_schedule($default);
    $rows = [];
    $rowsStmt = $pdo->query('SELECT payload_json FROM schedule_rows ORDER BY position ASC, id ASC');
    if ($rowsStmt instanceof PDOStatement) {
        foreach ($rowsStmt as $row) {
            $decodedRow = json_decode((string) ($row['payload_json'] ?? ''), true);
            $rows[] = is_array($decodedRow) ? $decodedRow : [];
        }
    }
    if ($rows) {
        $schedule['rows'] = $rows;
    }

    return $schedule;
}

function signage_write_schedule_to_db(array $schedule, ?string &$error = null): bool
{
    $normalized = signage_normalize_schedule($schedule);

    try {
        $pdo = signage_db();
    } catch (Throwable $e) {
        $error = $e->getMessage();
        return false;
    }

    $payload = json_encode($normalized, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($payload === false) {
        $error = 'json_encode failed: ' . json_last_error_msg();
        return false;
    }

    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('INSERT OR REPLACE INTO settings (key, payload_json) VALUES (:key, :payload)');
        $stmt->execute([
            ':key' => 'schedule_full',
            ':payload' => $payload,
        ]);
        $pdo->exec('DELETE FROM schedule_rows');
        $insert = $pdo->prepare('INSERT INTO schedule_rows (position, payload_json) VALUES (:position, :payload)');
        $position = 0;
        foreach ($normalized['rows'] as $row) {
            $rowPayload = json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($rowPayload === false) {
                continue;
            }
            $insert->execute([
                ':position' => $position++,
                ':payload' => $rowPayload,
            ]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        $error = $e->getMessage();
        return false;
    }

    return signage_write_json_file('schedule.json', $normalized, $error);
}

function signage_absolute_path(string $relative): string
{
    if ($relative === '' || $relative[0] !== '/') {
        $relative = '/' . ltrim($relative, '/');
    }
    return signage_base_path() . $relative;
}

