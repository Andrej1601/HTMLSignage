<?php
// Gemeinsame Helfer für Dateipfade und JSON-Zugriff
// Stellt zentrale Funktionen bereit, damit Pfade nicht hart codiert werden
// und Deployments mit abweichenden Wurzelverzeichnissen funktionieren.

declare(strict_types=1);

const SIGNAGE_JSON_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT;

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

function signage_read_json(string $file, array $default = []): array
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

function signage_write_json(string $file, $data, ?string &$error = null): bool
{
    $path = signage_data_path($file);
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 02775, true) && !is_dir($dir)) {
        $error = 'unable to create directory: ' . $dir;
        return false;
    }
    $json = json_encode($data, SIGNAGE_JSON_FLAGS);
    if ($json === false) {
        $error = 'json_encode failed: ' . json_last_error_msg();
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

function signage_absolute_path(string $relative): string
{
    if ($relative === '' || $relative[0] !== '/') {
        $relative = '/' . ltrim($relative, '/');
    }
    return signage_base_path() . $relative;
}

