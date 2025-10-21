<?php
// Gemeinsame Helfer für Dateipfade und JSON-Zugriff
// Stellt zentrale Funktionen bereit, damit Pfade nicht hart codiert werden
// und Deployments mit abweichenden Wurzelverzeichnissen funktionieren.

declare(strict_types=1);

const SIGNAGE_JSON_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT;
const SIGNAGE_SCHEDULE_STORAGE_KEY = 'schedule.state';
const SIGNAGE_SETTINGS_STORAGE_KEY = 'settings.state';
const SIGNAGE_SQLITE_BUSY_TIMEOUT_MS = 5000;

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

/**
 * Apply connection-level pragmas to improve SQLite concurrency and durability.
 */
function signage_sqlite_configure(\PDO $pdo): void
{
    $pragmas = [
        'journal_mode = WAL' => 'Unable to enable SQLite WAL mode',
        'busy_timeout = ' . SIGNAGE_SQLITE_BUSY_TIMEOUT_MS => 'Unable to set SQLite busy_timeout pragma',
        'synchronous = NORMAL' => 'Unable to set SQLite synchronous pragma',
        'foreign_keys = ON' => 'Unable to enable SQLite foreign_keys pragma',
    ];

    foreach ($pragmas as $pragma => $message) {
        try {
            $pdo->exec('PRAGMA ' . $pragma);
        } catch (Throwable $exception) {
            error_log($message . ': ' . $exception->getMessage());
        }
    }
}

/**
 * Retry transient write operations that fail with "database is locked".
 */
function signage_sqlite_retry(callable $operation, int $attempts = 5, int $sleepMs = 150): mixed
{
    $attempts = max(1, $attempts);
    $sleepUs = max(0, $sleepMs) * 1000;
    $lastException = null;

    for ($i = 0; $i < $attempts; $i++) {
        try {
            return $operation();
        } catch (Throwable $exception) {
            $message = strtolower((string) $exception->getMessage());
            if (strpos($message, 'database is locked') === false) {
                throw $exception;
            }

            $lastException = $exception;
            if ($i === $attempts - 1) {
                break;
            }

            if ($sleepUs > 0) {
                usleep($sleepUs);
            }
        }
    }

    if ($lastException instanceof Throwable) {
        throw $lastException;
    }

    throw new RuntimeException('SQLite operation failed after retries.');
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

    signage_sqlite_configure($pdo);

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
            signage_sqlite_retry(function () use ($pdo, $sql): void {
                $pdo->exec($sql);
            });
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
        signage_sqlite_retry(function () use ($pdo, $key, $json, $ts): void {
            $stmt = $pdo->prepare('INSERT INTO kv_store(key, value, updated_at) VALUES (:key, :value, :updated)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at');
            $stmt->execute([
                ':key' => $key,
                ':value' => $json,
                ':updated' => $ts,
            ]);
        });
    } catch (Throwable $exception) {
        throw new RuntimeException('Failed to persist SQLite value: ' . $exception->getMessage(), 0, $exception);
    }
}

function signage_kv_patch(string $key, array $patch): bool
{
    if (empty($patch)) {
        return false;
    }

    try {
        signage_db_bootstrap();
        $pdo = signage_db();
    } catch (Throwable $exception) {
        throw new RuntimeException('Unable to access SQLite store: ' . $exception->getMessage(), 0, $exception);
    }

    $json = json_encode($patch, SIGNAGE_JSON_FLAGS);
    if ($json === false) {
        throw new RuntimeException('json_encode failed: ' . json_last_error_msg());
    }

    $ts = time();

    try {
        return signage_sqlite_retry(function () use ($pdo, $key, $json, $ts): bool {
            $stmt = $pdo->prepare(
                'UPDATE kv_store
                 SET value = json_patch(COALESCE(value, "{}"), :patch), updated_at = :updated
                 WHERE key = :key AND json_patch(COALESCE(value, "{}"), :patch) != value'
            );
            $stmt->execute([
                ':key' => $key,
                ':patch' => $json,
                ':updated' => $ts,
            ]);

            return $stmt->rowCount() > 0;
        });
    } catch (Throwable $exception) {
        throw new RuntimeException('Failed to patch SQLite value: ' . $exception->getMessage(), 0, $exception);
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

function signage_default_settings(): array
{
    return [
        'version' => 1,
        'theme' => [
            'bg' => '#E8DEBD',
            'fg' => '#5C3101',
            'accent' => '#5C3101',
            'gridBorder' => '#5C3101',
            'gridTable' => '#5C3101',
            'gridTableW' => 2,
            'cellBg' => '#5C3101',
            'boxFg' => '#FFFFFF',
            'headRowBg' => '#E8DEBD',
            'headRowFg' => '#5C3101',
            'timeColBg' => '#E8DEBD',
            'timeZebra1' => '#EAD9A0',
            'timeZebra2' => '#E2CE91',
            'zebra1' => '#EDDFAF',
            'zebra2' => '#E6D6A1',
            'cornerBg' => '#E8DEBD',
            'cornerFg' => '#5C3101',
            'tileBorder' => '#5C3101',
            'chipBorder' => '#5C3101',
            'chipBorderW' => 2,
            'flame' => '#FFD166',
            'saunaColor' => '#5C3101',
        ],
        'fonts' => [
            'family' => "-apple-system, Segoe UI, Roboto, Arial, Noto Sans, Ubuntu, Cantarell, 'Helvetica Neue', sans-serif",
            'scale' => 1,
            'h1Scale' => 1,
            'h2Scale' => 1,
            'overviewTitleScale' => 1,
            'overviewHeadScale' => 0.9,
            'overviewCellScale' => 0.8,
            'overviewTimeScale' => 0.8,
            'tileTextScale' => 0.8,
            'tileWeight' => 600,
            'chipHeight' => 1,
            'chipOverflowMode' => 'scale',
            'flamePct' => 55,
            'flameGapScale' => 0.14,
        ],
        'h2' => [
            'mode' => 'text',
            'text' => 'Aufgusszeiten',
            'showOnOverview' => true,
        ],
        'display' => [
            'fit' => 'cover',
            'rightWidthPercent' => 38,
            'cutTopPercent' => 28,
            'cutBottomPercent' => 12,
        ],
        'slides' => [
            'overviewDurationSec' => 10,
            'saunaDurationSec' => 6,
            'transitionMs' => 500,
            'tileWidthPercent' => 45,
            'tileMinScale' => 0.25,
            'tileMaxScale' => 0.57,
            'tileFlameSizeScale' => 1,
            'tileFlameGapScale' => 1,
            'durationMode' => 'uniform',
            'globalDwellSec' => 6,
            'loop' => true,
            'order' => ['overview'],
            'saunaTitleMaxWidthPercent' => 64,
        ],
        'assets' => [
            'rightImages' => [],
            'flameImage' => '/assets/img/flame_test.svg',
        ],
        'footnotes' => [
            ['id' => 'star', 'label' => '*', 'text' => 'Nur am Fr und Sa'],
        ],
        'interstitials' => [],
        'presets' => [],
        'presetAuto' => false,
    ];
}

function signage_normalize_settings($settings, ?array $fallback = null): array
{
    if (!is_array($settings)) {
        return $fallback ?? signage_default_settings();
    }
    return $settings;
}

function signage_schedule_load(?array $fallback = null): array
{
    $default = signage_normalize_schedule($fallback ?? signage_default_schedule());

    if (signage_db_available()) {
        try {
            $state = signage_kv_get(SIGNAGE_SCHEDULE_STORAGE_KEY, null);
            if (is_array($state)) {
                return signage_normalize_schedule($state);
            }
        } catch (Throwable $exception) {
            error_log('Failed to load schedule from SQLite: ' . $exception->getMessage());
        }

        $import = signage_read_json_file('schedule.json', $default);
        $import = signage_normalize_schedule($import);
        try {
            signage_kv_set(SIGNAGE_SCHEDULE_STORAGE_KEY, $import);
        } catch (Throwable $exception) {
            error_log('Failed to import schedule into SQLite: ' . $exception->getMessage());
        }
        signage_delete_data_file('schedule.json');
        return $import;
    }

    $schedule = signage_read_json_file('schedule.json', $default);
    return signage_normalize_schedule($schedule);
}

function signage_settings_load(?array $fallback = null): array
{
    $baseDefault = signage_default_settings();
    $default = signage_normalize_settings($fallback ?? $baseDefault, $baseDefault);

    if (signage_db_available()) {
        try {
            $state = signage_kv_get(SIGNAGE_SETTINGS_STORAGE_KEY, null);
            if (is_array($state)) {
                return signage_normalize_settings($state, $default);
            }
        } catch (Throwable $exception) {
            error_log('Failed to load settings from SQLite: ' . $exception->getMessage());
        }

        $import = signage_read_json_file('settings.json', $default);
        $import = signage_normalize_settings($import, $default);
        try {
            signage_kv_set(SIGNAGE_SETTINGS_STORAGE_KEY, $import);
        } catch (Throwable $exception) {
            error_log('Failed to import settings into SQLite: ' . $exception->getMessage());
        }
        signage_delete_data_file('settings.json');
        return $import;
    }

    $settings = signage_read_json_file('settings.json', $default);
    return signage_normalize_settings($settings, $default);
}

function signage_schedule_save($schedule, ?string &$error = null): bool
{
    $error = null;
    $normalized = signage_normalize_schedule(is_array($schedule) ? $schedule : []);
    $errors = [];

    $hasSqlite = signage_db_available();
    $sqliteOk = false;

    if ($hasSqlite) {
        try {
            signage_kv_set(SIGNAGE_SCHEDULE_STORAGE_KEY, $normalized);
            $sqliteOk = true;
        } catch (Throwable $exception) {
            $errors[] = 'sqlite: ' . $exception->getMessage();
        }
    }

    $fileOk = true;
    if (!$hasSqlite || !$sqliteOk) {
        $fileError = null;
        $fileOk = signage_write_json_file('schedule.json', $normalized, $fileError);
        if (!$fileOk) {
            $errors[] = 'file: ' . ($fileError ?? 'write-failed');
        }
    } else {
        signage_delete_data_file('schedule.json');
    }

    if ($errors) {
        $error = implode('; ', $errors);
    }

    return $hasSqlite ? $sqliteOk : $fileOk;
}

function signage_settings_save($settings, ?string &$error = null): bool
{
    $error = null;
    $normalized = signage_normalize_settings($settings, signage_default_settings());
    $errors = [];

    $hasSqlite = signage_db_available();
    $sqliteOk = false;

    if ($hasSqlite) {
        try {
            signage_kv_set(SIGNAGE_SETTINGS_STORAGE_KEY, $normalized);
            $sqliteOk = true;
        } catch (Throwable $exception) {
            $errors[] = 'sqlite: ' . $exception->getMessage();
        }
    }

    $fileOk = true;
    if (!$hasSqlite || !$sqliteOk) {
        $fileError = null;
        $fileOk = signage_write_json_file('settings.json', $normalized, $fileError);
        if (!$fileOk) {
            $errors[] = 'file: ' . ($fileError ?? 'write-failed');
        }
    } else {
        signage_delete_data_file('settings.json');
    }

    if ($errors) {
        $error = implode('; ', $errors);
    }

    return $hasSqlite ? $sqliteOk : $fileOk;
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

function signage_read_json(string $file, array $default = []): array
{
    switch ($file) {
        case 'schedule.json':
            return signage_schedule_load($default ?: null);
        case 'settings.json':
            return signage_settings_load($default ?: null);
        default:
            return signage_read_json_file($file, $default);
    }
}

function signage_write_json_file(string $file, $data, ?string &$error = null): bool
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

function signage_write_json(string $file, $data, ?string &$error = null): bool
{
    switch ($file) {
        case 'schedule.json':
            return signage_schedule_save($data, $error);
        case 'settings.json':
            return signage_settings_save($data, $error);
        default:
            return signage_write_json_file($file, $data, $error);
    }
}

function signage_delete_data_file(string $file): void
{
    $path = signage_data_path($file);
    if (is_file($path)) {
        @unlink($path);
    }
}

function signage_kv_meta(string $key): array
{
    $meta = ['mtime' => 0, 'hash' => null];

    if (!signage_db_available()) {
        return $meta;
    }

    try {
        signage_db_bootstrap();
        $pdo = signage_db();
        $stmt = $pdo->prepare('SELECT updated_at, value FROM kv_store WHERE key = :key LIMIT 1');
        $stmt->execute([':key' => $key]);
        $row = $stmt->fetch();
        if (!$row) {
            return $meta;
        }
        $meta['mtime'] = isset($row['updated_at']) ? (int) $row['updated_at'] : 0;
        if (isset($row['value'])) {
            $meta['hash'] = sha1((string) $row['value']);
        }
        return $meta;
    } catch (Throwable $exception) {
        error_log('Failed to fetch SQLite metadata for key ' . $key . ': ' . $exception->getMessage());
    }

    return $meta;
}

function signage_absolute_path(string $relative): string
{
    if ($relative === '' || $relative[0] !== '/') {
        $relative = '/' . ltrim($relative, '/');
    }
    return signage_base_path() . $relative;
}

