<?php
// Gemeinsame Helfer für Dateipfade und JSON-Zugriff
// Stellt zentrale Funktionen bereit, damit Pfade nicht hart codiert werden
// und Deployments mit abweichenden Wurzelverzeichnissen funktionieren.

declare(strict_types=1);

require_once __DIR__ . '/db.php';

const SIGNAGE_JSON_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT;

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

