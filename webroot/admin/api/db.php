<?php
// /admin/api/db.php – zentrale PDO-SQLite-Verbindung und Migrationen
// Stellt signage_db() bereit und kümmert sich um Legacy-Importe aus JSON-Dateien.

declare(strict_types=1);

const SIGNAGE_DB_SCHEMA_VERSION = 1;

function signage_db_base_path(): string
{
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
            return $baseDir;
        }
        if (substr($baseDir, -6) === '/admin') {
            $parent = rtrim(dirname($baseDir), '/');
            if ($parent !== '' && is_dir($parent . '/data')) {
                return $parent;
            }
        }
    }

    $fallback = realpath(__DIR__ . '/../../');
    if ($fallback === false) {
        $fallback = __DIR__ . '/../../';
    }

    return rtrim($fallback, '/');
}

function signage_db_data_path(string $file = ''): string
{
    $base = signage_db_base_path();
    $dir = $base . '/data';
    if ($file === '') {
        return $dir;
    }
    return $dir . '/' . ltrim($file, '/');
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
    return signage_db_data_path('signage.sqlite');
}

function signage_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $path = signage_db_path();
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 02775, true) && !is_dir($dir)) {
        throw new RuntimeException('Unable to create database directory: ' . $dir);
    }

    $pdo = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA synchronous = NORMAL');
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA busy_timeout = 5000');

    signage_db_run_migrations($pdo);

    return $pdo;
}

function signage_db_run_migrations(PDO $pdo): void
{
    $versionStmt = $pdo->query('PRAGMA user_version');
    $current = (int) $versionStmt->fetchColumn();
    if ($current >= SIGNAGE_DB_SCHEMA_VERSION) {
        return;
    }

    if ($current < 1) {
        signage_db_migrate_to_v1($pdo);
    }
}

function signage_db_migrate_to_v1(PDO $pdo): void
{
    $pdo->beginTransaction();

    $pdo->exec('CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        name TEXT,
        created INTEGER,
        last_seen INTEGER,
        last_seen_at INTEGER,
        payload_json TEXT NOT NULL
    )');

    $pdo->exec('CREATE TABLE IF NOT EXISTS device_pairings (
        code TEXT PRIMARY KEY,
        device_id TEXT,
        created INTEGER,
        payload_json TEXT NOT NULL,
        FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE SET NULL
    )');

    $pdo->exec('CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        display_name TEXT,
        password TEXT,
        roles_json TEXT NOT NULL,
        permissions_json TEXT NOT NULL,
        permissions_version INTEGER NOT NULL DEFAULT 1,
        payload_json TEXT NOT NULL
    )');

    $pdo->exec('CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL
    )');

    $pdo->exec('CREATE TABLE IF NOT EXISTS schedule_rows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        position INTEGER NOT NULL,
        payload_json TEXT NOT NULL
    )');
    $pdo->exec('CREATE INDEX IF NOT EXISTS schedule_rows_position_idx ON schedule_rows(position)');

    signage_db_import_legacy_json($pdo);

    $pdo->exec('PRAGMA user_version = ' . SIGNAGE_DB_SCHEMA_VERSION);

    $pdo->commit();
}

function signage_db_import_legacy_json(PDO $pdo): void
{
    signage_db_import_devices_from_json($pdo, signage_db_data_path('devices.json'));
    signage_db_import_pairings_from_json($pdo, signage_db_data_path('devices.json'));
    signage_db_import_users_from_json($pdo, signage_db_data_path('users.json'));
    signage_db_import_settings_from_json($pdo, signage_db_data_path('settings.json'));
    signage_db_import_schedule_from_json($pdo, signage_db_data_path('schedule.json'));
}

function signage_db_import_devices_from_json(PDO $pdo, string $path): void
{
    if (!is_file($path)) {
        return;
    }
    $count = (int) $pdo->query('SELECT COUNT(*) FROM devices')->fetchColumn();
    if ($count > 0) {
        return;
    }
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') {
        return;
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return;
    }
    $devices = $decoded['devices'] ?? [];
    if (!is_array($devices)) {
        $devices = [];
    }
    $stmt = $pdo->prepare('INSERT OR IGNORE INTO devices (id, name, created, last_seen, last_seen_at, payload_json)
        VALUES (:id, :name, :created, :last_seen, :last_seen_at, :payload)');
    foreach ($devices as $key => $device) {
        if (!is_array($device)) {
            continue;
        }
        $id = (string) ($device['id'] ?? $key);
        $id = trim($id);
        if ($id === '') {
            continue;
        }
        $name = isset($device['name']) && is_string($device['name']) ? $device['name'] : $id;
        $created = isset($device['created']) ? (int) $device['created'] : null;
        $lastSeen = isset($device['lastSeen']) ? (int) $device['lastSeen'] : null;
        $lastSeenAt = isset($device['lastSeenAt']) ? (int) $device['lastSeenAt'] : null;
        $payload = json_encode($device, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($payload === false) {
            continue;
        }
        $stmt->execute([
            ':id' => $id,
            ':name' => $name,
            ':created' => $created,
            ':last_seen' => $lastSeen,
            ':last_seen_at' => $lastSeenAt,
            ':payload' => $payload,
        ]);
    }
}

function signage_db_import_pairings_from_json(PDO $pdo, string $path): void
{
    if (!is_file($path)) {
        return;
    }
    $count = (int) $pdo->query('SELECT COUNT(*) FROM device_pairings')->fetchColumn();
    if ($count > 0) {
        return;
    }
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') {
        return;
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded) || empty($decoded['pairings']) || !is_array($decoded['pairings'])) {
        return;
    }
    $stmt = $pdo->prepare('INSERT OR IGNORE INTO device_pairings (code, device_id, created, payload_json)
        VALUES (:code, :device_id, :created, :payload)');
    foreach ($decoded['pairings'] as $code => $pairing) {
        if (!is_array($pairing)) {
            continue;
        }
        $pairCode = isset($pairing['code']) && is_string($pairing['code']) ? $pairing['code'] : (is_string($code) ? $code : '');
        $pairCode = strtoupper(trim($pairCode));
        if ($pairCode === '') {
            continue;
        }
        $deviceId = isset($pairing['deviceId']) && is_string($pairing['deviceId']) ? trim($pairing['deviceId']) : null;
        $created = isset($pairing['created']) ? (int) $pairing['created'] : null;
        $payload = json_encode($pairing, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($payload === false) {
            continue;
        }
        $stmt->execute([
            ':code' => $pairCode,
            ':device_id' => $deviceId,
            ':created' => $created,
            ':payload' => $payload,
        ]);
    }
}

function signage_db_import_users_from_json(PDO $pdo, string $path): void
{
    if (!is_file($path)) {
        return;
    }
    $count = (int) $pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    if ($count > 0) {
        return;
    }
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') {
        return;
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded) || empty($decoded['users']) || !is_array($decoded['users'])) {
        return;
    }
    $stmt = $pdo->prepare('INSERT OR IGNORE INTO users (username, display_name, password, roles_json, permissions_json, permissions_version, payload_json)
        VALUES (:username, :display_name, :password, :roles, :permissions, :permissions_version, :payload)');
    foreach ($decoded['users'] as $entry) {
        if (!is_array($entry) || empty($entry['username'])) {
            continue;
        }
        $username = strtolower(trim((string) $entry['username']));
        if ($username === '') {
            continue;
        }
        $displayName = isset($entry['displayName']) && is_string($entry['displayName']) ? $entry['displayName'] : null;
        $password = isset($entry['password']) && is_string($entry['password']) ? $entry['password'] : null;
        $roles = isset($entry['roles']) && is_array($entry['roles']) ? $entry['roles'] : [];
        $permissions = isset($entry['permissions']) && is_array($entry['permissions']) ? $entry['permissions'] : [];
        $version = isset($entry['permissionsVersion']) ? (int) $entry['permissionsVersion'] : 1;
        $payload = json_encode($entry, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($payload === false) {
            continue;
        }
        $stmt->execute([
            ':username' => $username,
            ':display_name' => $displayName,
            ':password' => $password,
            ':roles' => json_encode(array_values($roles), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':permissions' => json_encode(array_values($permissions), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            ':permissions_version' => $version,
            ':payload' => $payload,
        ]);
    }
}

function signage_db_import_settings_from_json(PDO $pdo, string $path): void
{
    if (!is_file($path)) {
        return;
    }
    $count = (int) $pdo->query('SELECT COUNT(*) FROM settings WHERE key = "app_settings"')->fetchColumn();
    if ($count > 0) {
        return;
    }
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') {
        return;
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return;
    }
    $payload = json_encode($decoded, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($payload === false) {
        return;
    }
    $stmt = $pdo->prepare('INSERT OR REPLACE INTO settings (key, payload_json) VALUES (:key, :payload)');
    $stmt->execute([
        ':key' => 'app_settings',
        ':payload' => $payload,
    ]);
}

function signage_db_import_schedule_from_json(PDO $pdo, string $path): void
{
    if (!is_file($path)) {
        return;
    }
    $count = (int) $pdo->query('SELECT COUNT(*) FROM settings WHERE key = "schedule_full"')->fetchColumn();
    if ($count > 0) {
        return;
    }
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') {
        return;
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return;
    }
    $payload = json_encode($decoded, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($payload === false) {
        return;
    }
    $stmt = $pdo->prepare('INSERT OR REPLACE INTO settings (key, payload_json) VALUES (:key, :payload)');
    $stmt->execute([
        ':key' => 'schedule_full',
        ':payload' => $payload,
    ]);

    $rows = $decoded['rows'] ?? [];
    if (is_array($rows) && $rows) {
        $insertRow = $pdo->prepare('INSERT INTO schedule_rows (position, payload_json) VALUES (:position, :payload)');
        $position = 0;
        foreach ($rows as $row) {
            if (!is_array($row)) {
                $row = [];
            }
            $rowPayload = json_encode($row, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($rowPayload === false) {
                continue;
            }
            $insertRow->execute([
                ':position' => $position++,
                ':payload' => $rowPayload,
            ]);
        }
    }
}
