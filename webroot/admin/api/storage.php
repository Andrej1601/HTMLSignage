<?php
// Gemeinsame Helfer für Dateipfade und JSON-Zugriff
// Stellt zentrale Funktionen bereit, damit Pfade nicht hart codiert werden
// und Deployments mit abweichenden Wurzelverzeichnissen funktionieren.

declare(strict_types=1);

const SIGNAGE_JSON_RESPONSE_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
const SIGNAGE_JSON_STORAGE_FLAGS = SIGNAGE_JSON_RESPONSE_FLAGS | JSON_PRETTY_PRINT;
const SIGNAGE_SCHEDULE_STORAGE_KEY = 'schedule.state';
const SIGNAGE_SETTINGS_STORAGE_KEY = 'settings.state';
const SIGNAGE_CACHE_SCHEDULE_KEY = 'cache.schedule.state';
const SIGNAGE_CACHE_SCHEDULE_TTL = 30;
const SIGNAGE_SQLITE_BUSY_TIMEOUT_MS = 5000;
const SIGNAGE_AUDIT_LOG_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;
const SIGNAGE_AUDIT_LOG_MAX_ROWS = 5000;
const SIGNAGE_AUDIT_LOG_PRUNE_INTERVAL = 300;
const SIGNAGE_JSON_MAX_TREE_NODES = 20000;
const SIGNAGE_JSON_MAX_TREE_DEPTH = 16;
const SIGNAGE_JSON_MAX_STRING_BYTES = 131072;
const SIGNAGE_SCHEDULE_MAX_SLIDES = 2000;

function signage_last_error_message(string $fallback): string
{
    $error = error_get_last();
    if (is_array($error) && isset($error['message']) && $error['message'] !== '') {
        return $error['message'];
    }

    return $fallback;
}

function signage_ini_bool(string $key, bool $default = false): bool
{
    $value = ini_get($key);
    if ($value === false) {
        return $default;
    }

    $value = strtolower((string) $value);
    if ($value === '1' || $value === 'on' || $value === 'yes' || $value === 'true') {
        return true;
    }

    if ($value === '' || $value === '0' || $value === 'off' || $value === 'no' || $value === 'false') {
        return false;
    }

    return $default;
}

function signage_flush_stream($handle, ?string &$error = null): bool
{
    if (!is_resource($handle)) {
        $error = 'invalid stream resource';
        return false;
    }

    if (!@fflush($handle)) {
        $error = 'fflush failed';
        return false;
    }

    if (function_exists('fsync') && !@fsync($handle)) {
        $error = signage_last_error_message('fsync failed');
        return false;
    }

    return true;
}

function signage_read_file_locked(string $path, ?string &$error = null): ?string
{
    $error = null;

    if (!is_file($path)) {
        return null;
    }

    if (function_exists('error_clear_last')) {
        error_clear_last();
    }

    $handle = @fopen($path, 'rb');
    if ($handle === false) {
        $error = signage_last_error_message('unable to open file for reading');
        return null;
    }

    $locked = @flock($handle, LOCK_SH);
    if (!$locked) {
        $error = 'unable to acquire shared lock';
        fclose($handle);
        return null;
    }

    $contents = stream_get_contents($handle);
    if ($contents === false) {
        $error = 'unable to read from file';
        flock($handle, LOCK_UN);
        fclose($handle);
        return null;
    }

    flock($handle, LOCK_UN);
    fclose($handle);

    return $contents;
}

function signage_validate_json_tree($value, string $path, int $depth, array &$stats, ?string &$error = null): bool
{
    if ($depth > SIGNAGE_JSON_MAX_TREE_DEPTH) {
        $error = 'depth-exceeded:' . $path;
        return false;
    }

    $stats['nodes']++;
    if ($stats['nodes'] > SIGNAGE_JSON_MAX_TREE_NODES) {
        $error = 'node-limit-exceeded:' . $path;
        return false;
    }

    if (is_array($value)) {
        foreach ($value as $key => $child) {
            if (!is_int($key) && !is_string($key)) {
                $error = 'invalid-key:' . $path;
                return false;
            }
            if (!signage_validate_json_tree($child, $path . '/' . (string) $key, $depth + 1, $stats, $error)) {
                return false;
            }
        }
        return true;
    }

    if (is_string($value)) {
        if (strlen($value) > SIGNAGE_JSON_MAX_STRING_BYTES) {
            $error = 'string-too-long:' . $path;
            return false;
        }
        return true;
    }

    if (is_int($value)) {
        return true;
    }

    if (is_float($value)) {
        if (!is_finite($value)) {
            $error = 'invalid-number:' . $path;
            return false;
        }
        return true;
    }

    if (is_bool($value) || $value === null) {
        return true;
    }

    $error = 'unsupported-type:' . $path;
    return false;
}

function signage_validate_json_document($document, string $context, ?string &$error = null, ?array &$stats = null): bool
{
    $treeStats = ['nodes' => 0];
    $treeError = null;
    if (!signage_validate_json_tree($document, $context, 0, $treeStats, $treeError)) {
        $error = $context . '-' . ($treeError ?? 'invalid');
        return false;
    }

    if (func_num_args() >= 4) {
        $stats = $treeStats;
    }

    return true;
}

function signage_validate_schedule_payload($schedule, ?string &$error = null): bool
{
    if (!is_array($schedule)) {
        $error = 'schedule-invalid-structure';
        return false;
    }

    if (!array_key_exists('version', $schedule)) {
        $error = 'schedule-version-missing';
        return false;
    }

    $version = $schedule['version'];
    if (!is_int($version)) {
        if (is_numeric($version)) {
            $version = (int) $version;
        } else {
            $error = 'schedule-version-invalid';
            return false;
        }
    }

    if ($version < 0 || $version > PHP_INT_MAX) {
        $error = 'schedule-version-range';
        return false;
    }

    if (isset($schedule['slides'])) {
        if (!is_array($schedule['slides'])) {
            $error = 'schedule-slides-invalid';
            return false;
        }
        if (count($schedule['slides']) > SIGNAGE_SCHEDULE_MAX_SLIDES) {
            $error = 'schedule-slides-too-many';
            return false;
        }
        foreach ($schedule['slides'] as $index => $slide) {
            if (!is_array($slide)) {
                $error = 'schedule-slide-invalid-' . $index;
                return false;
            }
        }
    }

    return signage_validate_json_document($schedule, 'schedule', $error);
}

function signage_validate_settings_payload($settings, ?string &$error = null): bool
{
    if (!is_array($settings)) {
        $error = 'settings-invalid-structure';
        return false;
    }

    if (!array_key_exists('version', $settings)) {
        $error = 'settings-version-missing';
        return false;
    }

    $version = $settings['version'];
    if (!is_int($version)) {
        if (is_numeric($version)) {
            $version = (int) $version;
        } else {
            $error = 'settings-version-invalid';
            return false;
        }
    }

    if ($version < 0 || $version > PHP_INT_MAX) {
        $error = 'settings-version-range';
        return false;
    }

    return signage_validate_json_document($settings, 'settings', $error);
}

function signage_atomic_file_put_contents(string $path, string $contents, ?string &$error = null): bool
{
    $error = null;
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 02775, true) && !is_dir($dir)) {
        $error = 'unable to create directory: ' . $dir;
        return false;
    }

    if (function_exists('error_clear_last')) {
        error_clear_last();
    }

    $temp = @tempnam($dir, basename($path) . '.tmp');
    if ($temp === false) {
        $error = 'unable to create temporary file in ' . $dir;
        return false;
    }

    $handle = @fopen($temp, 'wb');
    if ($handle === false) {
        $error = signage_last_error_message('unable to open temporary file for writing');
        @unlink($temp);
        return false;
    }

    $bytesTotal = strlen($contents);
    $bytesWritten = 0;
    $buffer = $contents;
    while ($bytesWritten < $bytesTotal) {
        $chunk = @fwrite($handle, $buffer);
        if ($chunk === false) {
            $error = 'unable to write to temporary file';
            @fclose($handle);
            @unlink($temp);
            return false;
        }
        if ($chunk === 0) {
            $error = 'unable to write to temporary file';
            @fclose($handle);
            @unlink($temp);
            return false;
        }
        $bytesWritten += $chunk;
        if ($bytesWritten < $bytesTotal) {
            $buffer = substr($buffer, $chunk);
        }
    }

    if (!signage_flush_stream($handle, $error)) {
        @fclose($handle);
        @unlink($temp);
        return false;
    }

    @fclose($handle);

    if (function_exists('error_clear_last')) {
        error_clear_last();
    }

    if (!@rename($temp, $path)) {
        $error = signage_last_error_message('unable to replace target file');
        @unlink($temp);
        return false;
    }

    return true;
}

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

    signage_sqlite_supports_json_patch($pdo);
}

function signage_sqlite_supports_json_patch(\PDO $pdo): bool
{
    static $supported;
    if ($supported !== null) {
        return $supported;
    }

    try {
        $stmt = $pdo->query("SELECT json_patch('{}', '{}')");
        if ($stmt !== false) {
            $stmt->fetchColumn();
        }
        return $supported = true;
    } catch (Throwable $exception) {
        $supported = false;
        error_log('SQLite json_patch unavailable: ' . $exception->getMessage());
        return false;
    }
}

function signage_require_sqlite_json_patch(\PDO $pdo): void
{
    if (signage_sqlite_supports_json_patch($pdo)) {
        return;
    }

    throw new RuntimeException('SQLite json_patch() support is required. Please upgrade to SQLite 3.38+ with the JSON1 extension.');
}

function signage_array_is_list(array $value): bool
{
    if (function_exists('array_is_list')) {
        return array_is_list($value);
    }

    $expected = 0;
    foreach ($value as $key => $_) {
        if ($key !== $expected) {
            return false;
        }
        $expected++;
    }

    return true;
}

function signage_array_merge_patch(mixed $document, array $patch): array
{
    $document = is_array($document) ? $document : [];

    foreach ($patch as $key => $value) {
        if ($value === null) {
            unset($document[$key]);
            continue;
        }

        if (is_array($value) && !signage_array_is_list($value)) {
            $base = $document[$key] ?? [];
            $document[$key] = signage_array_merge_patch($base, $value);
            continue;
        }

        $document[$key] = is_array($value) && signage_array_is_list($value)
            ? array_values($value)
            : $value;
    }

    return $document;
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

function signage_sqlite_with_transaction(\PDO $pdo, callable $callback, string $mode = 'IMMEDIATE'): mixed
{
    $mode = strtoupper($mode);
    $validModes = ['DEFERRED', 'IMMEDIATE', 'EXCLUSIVE'];
    $begin = in_array($mode, $validModes, true)
        ? 'BEGIN ' . $mode . ' TRANSACTION'
        : 'BEGIN TRANSACTION';

    return signage_sqlite_retry(static function () use ($pdo, $callback, $begin) {
        $committed = false;
        $rolledBack = false;

        try {
            $pdo->exec($begin);
            $result = $callback($pdo);
            $pdo->exec('COMMIT');
            $committed = true;

            return $result;
        } catch (Throwable $exception) {
            if (!$committed && !$rolledBack) {
                try {
                    $pdo->exec('ROLLBACK');
                    $rolledBack = true;
                } catch (Throwable $rollbackException) {
                    error_log('SQLite rollback failed: ' . $rollbackException->getMessage());
                }
            }

            throw $exception;
        } finally {
            if (!$committed && !$rolledBack) {
                try {
                    $pdo->exec('ROLLBACK');
                } catch (Throwable $rollbackException) {
                    $message = strtolower((string) $rollbackException->getMessage());
                    if (strpos($message, 'no transaction') === false) {
                        error_log('SQLite rollback cleanup failed: ' . $rollbackException->getMessage());
                    }
                }
            }
        }
    });
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
        'CREATE TABLE IF NOT EXISTS device_store (
            id TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            updated_at INTEGER NOT NULL DEFAULT (strftime(\'%s\', \'now\'))
        )',
        'CREATE TABLE IF NOT EXISTS device_pairings (
            code TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            updated_at INTEGER NOT NULL DEFAULT (strftime(\'%s\', \'now\'))
        )',
        'CREATE TABLE IF NOT EXISTS device_metadata (
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
        'CREATE INDEX IF NOT EXISTS audit_log_created_at_idx ON audit_log (created_at DESC, id DESC)',
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

    $json = json_encode($value, SIGNAGE_JSON_STORAGE_FLAGS);
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

    signage_require_sqlite_json_patch($pdo);

    $json = json_encode($patch, SIGNAGE_JSON_STORAGE_FLAGS);
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

function signage_audit_log_prune(\PDO $pdo): void
{
    static $lastRun = 0;
    $now = time();
    if ($now - $lastRun < SIGNAGE_AUDIT_LOG_PRUNE_INTERVAL) {
        return;
    }

    $lastRun = $now;

    $threshold = $now - SIGNAGE_AUDIT_LOG_MAX_AGE_SECONDS;

    if ($threshold > 0) {
        try {
            signage_sqlite_retry(function () use ($pdo, $threshold): void {
                $stmt = $pdo->prepare('DELETE FROM audit_log WHERE created_at < :cutoff');
                $stmt->execute([':cutoff' => $threshold]);
            });
        } catch (Throwable $exception) {
            error_log('Failed to prune old audit entries: ' . $exception->getMessage());
        }
    }

    if (SIGNAGE_AUDIT_LOG_MAX_ROWS > 0) {
        try {
            signage_sqlite_retry(function () use ($pdo): void {
                $stmt = $pdo->prepare(
                    'DELETE FROM audit_log
                     WHERE id NOT IN (
                        SELECT id FROM audit_log ORDER BY created_at DESC, id DESC LIMIT :limit
                     )'
                );
                $stmt->bindValue(':limit', SIGNAGE_AUDIT_LOG_MAX_ROWS, \PDO::PARAM_INT);
                $stmt->execute();
            });
        } catch (Throwable $exception) {
            error_log('Failed to enforce audit log size limit: ' . $exception->getMessage());
        }
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

    signage_prune_missing_asset_paths($schedule);

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
        'audio' => [
            'background' => [
                'enabled' => false,
                'activeTrack' => 'default',
                'src' => '',
                'volume' => 0.5,
                'loop' => true,
                'tracks' => [
                    'default' => [
                        'label' => 'Standard',
                        'src' => '',
                        'volume' => 0.5,
                        'loop' => true,
                    ],
                ],
            ],
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

    $baseDefault = $fallback ?? signage_default_settings();
    $normalized = $settings;

    $audioDefaults = $baseDefault['audio']['background'] ?? signage_default_settings()['audio']['background'];
    $audioState = isset($normalized['audio']) && is_array($normalized['audio']) ? $normalized['audio'] : [];
    $background = $audioState['background'] ?? [];
    $audioState['background'] = signage_normalize_background_audio($background, $audioDefaults);
    $normalized['audio'] = $audioState;

    signage_prune_missing_asset_paths($normalized);

    return $normalized;
}

function signage_normalize_audio_track($input, array $fallback, array $global): array
{
    $track = is_array($input) ? $input : [];
    $fb = $fallback;
    $result = [];

    $label = isset($track['label']) && is_string($track['label']) ? trim($track['label']) : '';
    if ($label === '' && isset($fb['label']) && is_string($fb['label'])) {
        $label = trim($fb['label']);
    }
    if ($label !== '') {
        $result['label'] = $label;
    }

    $src = isset($track['src']) && is_string($track['src']) ? trim($track['src']) : '';
    if ($src === '' && isset($fb['src']) && is_string($fb['src'])) {
        $src = trim($fb['src']);
    }
    $result['src'] = $src;

    $volumeRaw = $track['volume'] ?? ($fb['volume'] ?? ($global['volume'] ?? 1.0));
    $volume = (float) $volumeRaw;
    if (!is_finite($volume)) {
        $volume = (float) ($fb['volume'] ?? ($global['volume'] ?? 1.0));
    }
    $volume = max(0.0, min(1.0, $volume));
    $result['volume'] = $volume;

    $loop = array_key_exists('loop', $track)
        ? ($track['loop'] !== false)
        : (array_key_exists('loop', $fb)
            ? ($fb['loop'] !== false)
            : (($global['loop'] ?? true) !== false));
    $result['loop'] = $loop;

    $fadeRaw = $track['fadeMs'] ?? ($fb['fadeMs'] ?? ($global['fadeMs'] ?? null));
    if (is_numeric($fadeRaw)) {
        $fade = (int) round($fadeRaw);
        if ($fade > 0) {
            $result['fadeMs'] = max(0, min(60000, $fade));
        }
    }

    return $result;
}

function signage_normalize_background_audio($input, array $default): array
{
    $state = is_array($input) ? $input : [];
    $defaultTracks = isset($default['tracks']) && is_array($default['tracks']) ? $default['tracks'] : [];

    $tracksInput = isset($state['tracks']) && is_array($state['tracks']) ? $state['tracks'] : [];
    if (empty($tracksInput) && isset($state['src'])) {
        $trackId = isset($state['activeTrack']) && is_string($state['activeTrack']) && trim($state['activeTrack']) !== ''
            ? trim($state['activeTrack'])
            : 'default';
        $tracksInput = [
            $trackId => [
                'label' => $state['trackLabel'] ?? '',
                'src' => $state['src'] ?? '',
                'volume' => $state['volume'] ?? null,
                'loop' => $state['loop'] ?? null,
                'fadeMs' => $state['fadeMs'] ?? null,
            ],
        ];
    }

    if (empty($tracksInput)) {
        $tracksInput = $defaultTracks;
    }

    if (empty($tracksInput)) {
        $tracksInput = [
            'default' => [
                'label' => 'Standard',
                'src' => '',
                'volume' => $default['volume'] ?? 1.0,
                'loop' => ($default['loop'] ?? true) !== false,
                'fadeMs' => $default['fadeMs'] ?? null,
            ],
        ];
    }

    $tracks = [];
    foreach ($tracksInput as $id => $track) {
        if (!is_string($id) && !is_int($id)) {
            continue;
        }
        $key = trim((string) $id);
        if ($key === '') {
            continue;
        }
        $fallback = isset($defaultTracks[$key]) && is_array($defaultTracks[$key]) ? $defaultTracks[$key] : [];
        $tracks[$key] = signage_normalize_audio_track($track, $fallback, $default);
    }

    $activeTrack = isset($state['activeTrack']) && is_string($state['activeTrack']) ? trim($state['activeTrack']) : '';
    if ($activeTrack === '' || !isset($tracks[$activeTrack])) {
        $defaultActive = isset($default['activeTrack']) && is_string($default['activeTrack']) ? trim($default['activeTrack']) : '';
        if ($defaultActive !== '' && isset($tracks[$defaultActive])) {
            $activeTrack = $defaultActive;
        } else {
            $keys = array_keys($tracks);
            $activeTrack = $keys ? $keys[0] : '';
        }
    }

    $desiredEnabled = ($state['enabled'] ?? true) !== false;
    $activeEntry = ($activeTrack !== '' && isset($tracks[$activeTrack])) ? $tracks[$activeTrack] : null;
    $enabled = $desiredEnabled && $activeEntry && $activeEntry['src'] !== '';

    $normalized = [
        'enabled' => $enabled,
        'activeTrack' => $activeTrack,
        'tracks' => $tracks,
    ];

    if ($activeEntry) {
        $normalized['src'] = $activeEntry['src'];
        $normalized['volume'] = $activeEntry['volume'];
        $normalized['loop'] = $activeEntry['loop'];
        if (isset($activeEntry['fadeMs'])) {
            $normalized['fadeMs'] = $activeEntry['fadeMs'];
        }
        if (!empty($activeEntry['label'])) {
            $normalized['trackLabel'] = $activeEntry['label'];
        }
    } else {
        $normalized['src'] = '';
        $volume = (float) ($default['volume'] ?? 1.0);
        if (!is_finite($volume)) {
            $volume = 1.0;
        }
        $normalized['volume'] = max(0.0, min(1.0, $volume));
        $normalized['loop'] = ($default['loop'] ?? true) !== false;
    }

    return $normalized;
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

function signage_schedule_save($schedule, ?string &$error = null, ?array &$status = null): bool
{
    $error = null;
    $normalized = signage_normalize_schedule(is_array($schedule) ? $schedule : []);
    $errors = [];

    $statusMap = [
        'sqlite' => ['attempted' => false, 'ok' => null, 'error' => null],
        'file' => ['attempted' => false, 'ok' => null, 'error' => null],
    ];

    $hasSqlite = signage_db_available();
    $sqliteOk = false;

    if ($hasSqlite) {
        $statusMap['sqlite']['attempted'] = true;
        try {
            signage_kv_set(SIGNAGE_SCHEDULE_STORAGE_KEY, $normalized);
            $sqliteOk = true;
            $statusMap['sqlite']['ok'] = true;
        } catch (Throwable $exception) {
            $errors[] = 'sqlite: ' . $exception->getMessage();
            $statusMap['sqlite']['error'] = $exception->getMessage();
        }
    }

    $fileOk = true;
    if (!$hasSqlite || !$sqliteOk) {
        $fileError = null;
        $statusMap['file']['attempted'] = true;
        $fileStatus = null;
        $fileOk = signage_write_json_file('schedule.json', $normalized, $fileError, $fileStatus);
        if (is_array($fileStatus)) {
            $statusMap['file'] = array_merge($statusMap['file'], $fileStatus);
        }
        if (!$fileOk) {
            $errors[] = 'file: ' . ($fileError ?? 'write-failed');
            if ($statusMap['file']['error'] === null) {
                $statusMap['file']['error'] = $fileError ?? 'write-failed';
            }
        }
    } else {
        signage_delete_data_file('schedule.json');
    }

    if ($errors) {
        $error = implode('; ', $errors);
    }

    if (func_num_args() >= 3) {
        $status = $statusMap;
    }

    $ok = $hasSqlite ? $sqliteOk : $fileOk;
    if ($ok) {
        signage_schedule_cache_clear();
    }

    return $ok;
}

function signage_settings_save($settings, ?string &$error = null, ?array &$status = null): bool
{
    $error = null;
    $normalized = signage_normalize_settings($settings, signage_default_settings());
    $errors = [];

    $statusMap = [
        'sqlite' => ['attempted' => false, 'ok' => null, 'error' => null],
        'file' => ['attempted' => false, 'ok' => null, 'error' => null],
    ];

    $hasSqlite = signage_db_available();
    $sqliteOk = false;

    if ($hasSqlite) {
        $statusMap['sqlite']['attempted'] = true;
        try {
            signage_kv_set(SIGNAGE_SETTINGS_STORAGE_KEY, $normalized);
            $sqliteOk = true;
            $statusMap['sqlite']['ok'] = true;
        } catch (Throwable $exception) {
            $errors[] = 'sqlite: ' . $exception->getMessage();
            $statusMap['sqlite']['error'] = $exception->getMessage();
        }
    }

    $fileOk = true;
    if (!$hasSqlite || !$sqliteOk) {
        $fileError = null;
        $statusMap['file']['attempted'] = true;
        $fileStatus = null;
        $fileOk = signage_write_json_file('settings.json', $normalized, $fileError, $fileStatus);
        if (is_array($fileStatus)) {
            $statusMap['file'] = array_merge($statusMap['file'], $fileStatus);
        }
        if (!$fileOk) {
            $errors[] = 'file: ' . ($fileError ?? 'write-failed');
            if ($statusMap['file']['error'] === null) {
                $statusMap['file']['error'] = $fileError ?? 'write-failed';
            }
        }
    } else {
        signage_delete_data_file('settings.json');
    }

    if ($errors) {
        $error = implode('; ', $errors);
    }

    if (func_num_args() >= 3) {
        $status = $statusMap;
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

function signage_asset_canonical_path($value): ?string
{
    if (is_array($value) || is_object($value)) {
        return null;
    }
    $raw = trim((string) $value);
    if ($raw === '') {
        return null;
    }
    $path = parse_url($raw, PHP_URL_PATH);
    if (!is_string($path) || $path === '') {
        $path = $raw;
    }
    if ($path === '') {
        return null;
    }
    if ($path[0] !== '/') {
        $path = '/' . ltrim($path, '/');
    }
    if (strpos($path, '/assets/') !== 0) {
        return null;
    }
    return $path;
}

function signage_asset_exists(string $path): bool
{
    static $cache = [];

    $absolute = signage_absolute_path($path);
    if ($absolute === '') {
        return false;
    }

    if (array_key_exists($absolute, $cache)) {
        return $cache[$absolute];
    }

    $exists = @is_file($absolute);
    $cache[$absolute] = $exists;

    return $exists;
}

function signage_prune_missing_asset_paths(&$value): void
{
    if (is_array($value)) {
        foreach ($value as &$item) {
            signage_prune_missing_asset_paths($item);
        }
        unset($item);
        return;
    }
    if (!is_string($value) && !is_numeric($value)) {
        return;
    }
    $path = signage_asset_canonical_path($value);
    if ($path === null) {
        return;
    }
    if (signage_asset_exists($path)) {
        return;
    }
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    $clearable = [
        'png','jpg','jpeg','webp','gif','svg','avif','heic','heif',
        'mp3','ogg','oga','wav','m4a','aac','flac','opus',
        'mp4','m4v','webm','ogv','mov'
    ];
    if (in_array($ext, $clearable, true)) {
        $value = '';
    }
}

function signage_read_json_file(string $file, array $default = []): array
{
    $path = signage_data_path($file);
    if (!is_file($path)) {
        return $default;
    }
    $error = null;
    $raw = signage_read_file_locked($path, $error);
    if ($raw === null) {
        if ($error !== null) {
            error_log('Failed to read JSON file ' . $path . ': ' . $error);
        }
        return $default;
    }
    if ($raw === '') {
        return $default;
    }
    $decoded = json_decode($raw, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        error_log('Invalid JSON in ' . $path . ': ' . json_last_error_msg());
        return $default;
    }
    if (!is_array($decoded)) {
        error_log('Unexpected JSON structure in ' . $path . ', falling back to default data');
        return $default;
    }
    return $decoded;
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

function signage_write_json_file(string $file, $data, ?string &$error = null, ?array &$status = null): bool
{
    $path = signage_data_path($file);
    $json = json_encode($data, SIGNAGE_JSON_STORAGE_FLAGS);
    if ($json === false) {
        $error = 'json_encode failed: ' . json_last_error_msg();
        if (func_num_args() >= 4) {
            $status = [
                'attempted' => true,
                'ok' => false,
                'error' => $error,
            ];
        }
        return false;
    }
    if (!signage_atomic_file_put_contents($path, $json, $error)) {
        if (func_num_args() >= 4) {
            $status = [
                'attempted' => true,
                'ok' => false,
                'error' => $error ?? 'write-failed',
            ];
        }
        return false;
    }
    @chmod($path, 0644);
    if (func_num_args() >= 4) {
        $status = [
            'attempted' => true,
            'ok' => true,
            'error' => null,
        ];
    }
    return true;
}

function signage_write_json(string $file, $data, ?string &$error = null, ?array &$status = null): bool
{
    switch ($file) {
        case 'schedule.json':
            return signage_schedule_save($data, $error, $status);
        case 'settings.json':
            return signage_settings_save($data, $error, $status);
        default:
            return signage_write_json_file($file, $data, $error, $status);
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
        $stmt = $pdo->prepare('SELECT updated_at, length(value) AS size FROM kv_store WHERE key = :key LIMIT 1');
        $stmt->execute([':key' => $key]);
        $row = $stmt->fetch();
        if (!$row) {
            return $meta;
        }
        $meta['mtime'] = isset($row['updated_at']) ? (int) $row['updated_at'] : 0;
        if (isset($row['size'])) {
            $size = (int) $row['size'];
            if ($size >= 0) {
                $meta['hash'] = $meta['mtime'] . ':' . $size;
            }
        }
        return $meta;
    } catch (Throwable $exception) {
        error_log('Failed to fetch SQLite metadata for key ' . $key . ': ' . $exception->getMessage());
    }

    return $meta;
}

function signage_data_meta(string $file, string $key): array
{
    $meta = signage_kv_meta($key);

    $path = signage_data_path($file);
    if (is_file($path)) {
        clearstatcache(false, $path);
        $fileMtime = @filemtime($path);
        if ($fileMtime !== false && ($meta['mtime'] ?? 0) <= 0) {
            $meta['mtime'] = (int) $fileMtime;
        }

        $fileSize = @filesize($path);
        if ($fileSize !== false && !isset($meta['hash'])) {
            $meta['hash'] = ($meta['mtime'] ?? 0) . ':' . (int) $fileSize;
        }
    }

    if (!isset($meta['mtime'])) {
        $meta['mtime'] = 0;
    }

    if (!array_key_exists('hash', $meta)) {
        $meta['hash'] = null;
    }

    return $meta;
}

function signage_cache_backend(): string
{
    static $backend = null;
    if ($backend !== null) {
        return $backend;
    }

    $useApcu = function_exists('apcu_fetch') && signage_ini_bool('apc.enabled', true);
    if ($useApcu && PHP_SAPI === 'cli' && !signage_ini_bool('apc.enable_cli')) {
        $useApcu = false;
    }

    if ($useApcu) {
        return $backend = 'apcu';
    }

    return $backend = 'file';
}

function signage_cache_file_path(string $key): string
{
    return signage_data_path('cache/' . sha1($key) . '.cache');
}

function signage_cache_get(string $key)
{
    $backend = signage_cache_backend();
    if ($backend === 'apcu') {
        $success = false;
        $value = apcu_fetch($key, $success);
        if ($success) {
            return $value;
        }
    }

    $path = signage_cache_file_path($key);
    if (!is_file($path)) {
        return null;
    }

    $payload = @file_get_contents($path);
    if ($payload === false || $payload === '') {
        return null;
    }

    $data = @unserialize($payload);
    if (!is_array($data) || !array_key_exists('value', $data)) {
        @unlink($path);
        return null;
    }

    $expiresAt = $data['expires_at'] ?? null;
    if (is_int($expiresAt) && $expiresAt > 0 && $expiresAt < time()) {
        @unlink($path);
        return null;
    }

    return $data['value'];
}

function signage_cache_set(string $key, $value, int $ttl = 0): bool
{
    $backend = signage_cache_backend();
    $ok = true;

    if ($backend === 'apcu') {
        $ok = apcu_store($key, $value, $ttl);
    }

    $path = signage_cache_file_path($key);
    $payload = serialize([
        'value' => $value,
        'expires_at' => $ttl > 0 ? time() + $ttl : null,
    ]);
    $error = null;
    if (!signage_atomic_file_put_contents($path, $payload, $error)) {
        error_log('Failed to write cache file ' . $path . ': ' . ($error ?? 'write-failed'));
        $ok = false;
    }

    return $ok;
}

function signage_cache_delete(string $key): void
{
    $backend = signage_cache_backend();
    if ($backend === 'apcu') {
        apcu_delete($key);
    }

    $path = signage_cache_file_path($key);
    if (is_file($path)) {
        @unlink($path);
    }
}

function signage_schedule_state(): array
{
    $cached = signage_cache_get(SIGNAGE_CACHE_SCHEDULE_KEY);
    if (is_array($cached) && isset($cached['data'], $cached['meta'])) {
        if (!isset($cached['json']) || !is_string($cached['json'])) {
            $encoded = json_encode($cached['data'], SIGNAGE_JSON_RESPONSE_FLAGS);
            $cached['json'] = $encoded === false ? null : $encoded;
            signage_cache_set(SIGNAGE_CACHE_SCHEDULE_KEY, $cached, SIGNAGE_CACHE_SCHEDULE_TTL);
        }

        if (!isset($cached['meta']['hash']) || $cached['meta']['hash'] === null) {
            $cached['meta']['hash'] = sha1(is_string($cached['json']) ? $cached['json'] : serialize($cached['data']));
            signage_cache_set(SIGNAGE_CACHE_SCHEDULE_KEY, $cached, SIGNAGE_CACHE_SCHEDULE_TTL);
        }

        return $cached;
    }

    $data = signage_schedule_load();
    $encoded = json_encode($data, SIGNAGE_JSON_RESPONSE_FLAGS);
    $json = $encoded === false ? null : $encoded;

    $meta = signage_data_meta('schedule.json', SIGNAGE_SCHEDULE_STORAGE_KEY);
    if (!isset($meta['mtime']) || !is_int($meta['mtime'])) {
        $meta['mtime'] = 0;
    }

    if (!isset($meta['hash']) || $meta['hash'] === null) {
        $meta['hash'] = sha1(is_string($json) ? $json : serialize($data));
    }

    $state = [
        'data' => $data,
        'meta' => $meta,
        'json' => $json,
    ];

    signage_cache_set(SIGNAGE_CACHE_SCHEDULE_KEY, $state, SIGNAGE_CACHE_SCHEDULE_TTL);

    return $state;
}

function signage_schedule_cache_clear(): void
{
    signage_cache_delete(SIGNAGE_CACHE_SCHEDULE_KEY);
}

function signage_format_http_date(int $timestamp): string
{
    if ($timestamp <= 0) {
        $timestamp = 0;
    }

    return gmdate('D, d M Y H:i:s', $timestamp) . ' GMT';
}

function signage_should_return_not_modified(string $etag, int $mtime): bool
{
    $etag = trim($etag, "\" \t");

    $ifNoneMatch = $_SERVER['HTTP_IF_NONE_MATCH'] ?? '';
    if ($ifNoneMatch !== '') {
        $values = explode(',', $ifNoneMatch);
        foreach ($values as $candidate) {
            $candidate = trim($candidate);
            if ($candidate === '') {
                continue;
            }

            if ($candidate === '*') {
                return true;
            }

            if (strpos($candidate, 'W/') === 0) {
                $candidate = substr($candidate, 2);
                $candidate = ltrim($candidate);
            }

            $candidate = trim($candidate, "\" \t");
            if ($candidate === $etag) {
                return true;
            }
        }

        return false;
    }

    $ifModifiedSince = $_SERVER['HTTP_IF_MODIFIED_SINCE'] ?? '';
    if ($ifModifiedSince !== '') {
        $timestamp = strtotime($ifModifiedSince);
        if ($timestamp !== false && $mtime <= $timestamp) {
            return true;
        }
    }

    return false;
}

function signage_absolute_path(string $relative): string
{
    if ($relative === '' || $relative[0] !== '/') {
        $relative = '/' . ltrim($relative, '/');
    }
    return signage_base_path() . $relative;
}

