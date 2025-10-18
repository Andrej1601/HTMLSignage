<?php
// /admin/api/devices_store.php – gemeinsame Helfer für Geräte-Datenbank
// Wird von Heartbeat- und Admin-APIs genutzt. Pfade werden zentral über
// devices_path() bestimmt, um harte Pfadangaben zu vermeiden.

declare(strict_types=1);

require_once __DIR__ . '/storage.php';

const DEVICES_ID_PATTERN = '/^dev_[a-f0-9]{12}$/';
const DEVICES_CODE_PATTERN = '/^[A-Z]{6}$/';
const DEVICES_HISTORY_LIMIT = 20;
const DEVICES_MAX_ERRORS = 10;
const DEVICES_STORAGE_JSON_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
const DEVICES_SQLITE_JOURNAL_MODE = 'WAL';
const DEVICES_SQLITE_BUSY_TIMEOUT_MS = 5000;

// >>> GENERATED: DEVICE_FIELD_CONFIG >>>
const DEVICES_STATUS_FIELD_CONFIG = [
    'firmware' => [
        'type' => 'string',
        'aliases' => [
            'firmware',
            'version',
        ],
        'maxLength' => 100,
    ],
    'appVersion' => [
        'type' => 'string',
        'aliases' => [
            'appVersion',
            'player',
        ],
        'maxLength' => 100,
    ],
    'ip' => [
        'type' => 'string',
        'aliases' => [
            'ip',
            'address',
        ],
        'maxLength' => 64,
    ],
    'notes' => [
        'type' => 'string',
        'aliases' => [
            'notes',
        ],
        'maxLength' => 180,
    ],
];

const DEVICES_NETWORK_FIELD_CONFIG = [
    'type' => [
        'type' => 'string',
        'aliases' => [
            'type',
            'interface',
        ],
        'maxLength' => 40,
    ],
    'ssid' => [
        'type' => 'string',
        'aliases' => [
            'ssid',
            'networkName',
        ],
        'maxLength' => 64,
    ],
    'quality' => [
        'type' => 'number',
        'aliases' => [
            'quality',
            'signalQuality',
            'linkQuality',
            'strength',
        ],
        'min' => 0,
        'max' => 100,
        'integer' => true,
        'round' => 'nearest',
    ],
    'signal' => [
        'type' => 'number',
        'aliases' => [
            'signal',
            'dbm',
            'wifiSignal',
            'strength',
            'rssi',
        ],
    ],
    'rssi' => [
        'type' => 'number',
        'aliases' => [
            'rssi',
        ],
        'integer' => true,
        'round' => 'nearest',
    ],
    'latency' => [
        'type' => 'number',
        'aliases' => [
            'latency',
        ],
        'min' => 0,
    ],
];

const DEVICES_METRIC_FIELD_CONFIG = [
    'cpuLoad' => [
        'type' => 'number',
        'aliases' => [
            'cpuLoad',
            'cpu',
            'cpu_usage',
            'cpuPercent',
            'cpuLoadPercent',
        ],
    ],
    'memoryUsage' => [
        'type' => 'number',
        'aliases' => [
            'memoryUsage',
            'memory',
            'ram',
            'memoryPercent',
            'memUsage',
            'ramUsage',
        ],
    ],
    'storageFree' => [
        'type' => 'number',
        'aliases' => [
            'storageFree',
            'storage_free',
            'storageFreeMb',
            'diskFree',
            'diskFreeMb',
            'freeStorage',
        ],
    ],
    'storageUsed' => [
        'type' => 'number',
        'aliases' => [
            'storageUsed',
            'storage_used',
            'storageUsedMb',
            'diskUsed',
            'diskUsedMb',
            'usedStorage',
        ],
    ],
    'temperature' => [
        'type' => 'number',
        'aliases' => [
            'temperature',
            'temp',
            'temperatureC',
            'tempC',
        ],
    ],
    'uptime' => [
        'type' => 'number',
        'aliases' => [
            'uptime',
            'upTimeSeconds',
            'uptimeSeconds',
            'uptimeSec',
        ],
    ],
    'batteryLevel' => [
        'type' => 'number',
        'aliases' => [
            'batteryLevel',
            'battery',
            'batteryPercent',
            'battery_level',
        ],
    ],
    'latency' => [
        'type' => 'number',
        'aliases' => [
            'latency',
            'ping',
        ],
    ],
];
// <<< GENERATED: DEVICE_FIELD_CONFIG <<<

function devices_truncate_string(string $value, int $length): string
{
    if ($length <= 0) {
        return '';
    }
    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        if (mb_strlen($value, 'UTF-8') > $length) {
            return mb_substr($value, 0, $length, 'UTF-8');
        }
        return $value;
    }
    return strlen($value) > $length ? substr($value, 0, $length) : $value;
}

function devices_optional_string($value, int $maxLength = 120): ?string
{
    if (!is_scalar($value)) {
        return null;
    }
    $string = trim((string) $value);
    if ($string === '') {
        return null;
    }
    return devices_truncate_string($string, $maxLength);
}

function devices_optional_number($value, array $config)
{
    if (!is_numeric($value)) {
        return null;
    }

    $number = (float) $value;

    if (isset($config['min'])) {
        $number = max((float) $config['min'], $number);
    }

    if (isset($config['max'])) {
        $number = min((float) $config['max'], $number);
    }

    if (isset($config['round'])) {
        switch ($config['round']) {
            case 'nearest':
                $number = round($number);
                break;
            case 'floor':
                $number = floor($number);
                break;
            case 'ceil':
                $number = ceil($number);
                break;
        }
    }

    if (!empty($config['integer'])) {
        return (int) $number;
    }

    return $number;
}

function devices_sanitize_fields(array $input, array $fieldConfig): array
{
    $result = [];

    foreach ($fieldConfig as $name => $config) {
        if (!isset($config['aliases']) || !is_array($config['aliases'])) {
            continue;
        }
        foreach ($config['aliases'] as $alias) {
            if (!array_key_exists($alias, $input)) {
                continue;
            }
            $raw = $input[$alias];
            if ($config['type'] === 'string') {
                $maxLength = $config['maxLength'] ?? 120;
                $value = devices_optional_string($raw, (int) $maxLength);
            } elseif ($config['type'] === 'number') {
                $value = devices_optional_number($raw, $config);
            } else {
                $value = null;
            }

            if ($value === null) {
                continue;
            }

            $result[$name] = $value;
            break;
        }
    }

    return $result;
}

function devices_sanitize_network($value): array
{
    if (!is_array($value)) {
        return [];
    }

    $network = devices_sanitize_fields($value, DEVICES_NETWORK_FIELD_CONFIG);

    if (isset($network['signal']) && !is_float($network['signal'])) {
        $network['signal'] = (float) $network['signal'];
    }

    if (isset($network['latency'])) {
        $network['latency'] = max(0, (float) $network['latency']);
    }

    if (isset($network['quality'])) {
        $network['quality'] = (int) $network['quality'];
    }

    return $network;
}

function devices_sanitize_errors($value): array
{
    if (!is_array($value)) {
        return [];
    }

    $errors = [];
    foreach ($value as $entry) {
        if (is_array($entry)) {
            $code = devices_optional_string($entry['code'] ?? null, 64);
            $message = devices_optional_string($entry['message'] ?? $entry['detail'] ?? null, 160);
            $ts = isset($entry['ts']) ? (int) $entry['ts'] : null;
            if ($code === null && $message === null) {
                continue;
            }
            $item = [];
            if ($code !== null) {
                $item['code'] = $code;
            }
            if ($message !== null) {
                $item['message'] = $message;
            }
            if ($ts) {
                $item['ts'] = $ts;
            }
            $errors[] = $item;
        } elseif (is_scalar($entry)) {
            $message = devices_optional_string($entry, 160);
            if ($message !== null) {
                $errors[] = ['message' => $message];
            }
        }
        if (count($errors) >= DEVICES_MAX_ERRORS) {
            break;
        }
    }

    return $errors;
}

function devices_sanitize_metrics($value): array
{
    if (!is_array($value)) {
        return [];
    }
    return devices_sanitize_fields($value, DEVICES_METRIC_FIELD_CONFIG);
}

function devices_sanitize_status($value): array
{
    if (!is_array($value)) {
        return [];
    }

    $status = devices_sanitize_fields($value, DEVICES_STATUS_FIELD_CONFIG);

    $networkSource = [];
    if (isset($value['network']) && is_array($value['network'])) {
        $networkSource = $value['network'];
    }
    if (isset($value['networkType']) && !isset($networkSource['type'])) {
        $networkSource['type'] = $value['networkType'];
    }
    if (isset($value['signal']) && !isset($networkSource['signal'])) {
        $networkSource['signal'] = $value['signal'];
    }
    if (isset($value['quality']) && !isset($networkSource['quality'])) {
        $networkSource['quality'] = $value['quality'];
    }
    if (isset($value['ssid']) && !isset($networkSource['ssid'])) {
        $networkSource['ssid'] = $value['ssid'];
    }
    $network = devices_sanitize_network($networkSource);
    if (!empty($network)) {
        $status['network'] = $network;
    }

    $errors = [];
    if (isset($value['errors'])) {
        $errors = devices_sanitize_errors($value['errors']);
    } elseif (isset($value['lastError'])) {
        $errors = devices_sanitize_errors([$value['lastError']]);
    }
    if (!empty($errors)) {
        $status['errors'] = $errors;
    }

    return $status;
}

function devices_sanitize_history($history): array
{
    if (!is_array($history)) {
        return [];
    }
    $normalized = [];
    foreach ($history as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $ts = isset($entry['ts']) ? (int) $entry['ts'] : null;
        if (!$ts) {
            continue;
        }
        $row = ['ts' => $ts];
        if (isset($entry['offline'])) {
            $row['offline'] = (bool) $entry['offline'];
        }
        if (isset($entry['status'])) {
            $status = devices_sanitize_status($entry['status']);
            if (!empty($status)) {
                $row['status'] = $status;
            }
        }
        if (isset($entry['metrics'])) {
            $metrics = devices_sanitize_metrics($entry['metrics']);
            if (!empty($metrics)) {
                $row['metrics'] = $metrics;
            }
        }
        $normalized[] = $row;
    }

    usort($normalized, static function ($a, $b) {
        return ($a['ts'] <=> $b['ts']);
    });

    $count = count($normalized);
    if ($count > DEVICES_HISTORY_LIMIT) {
        $normalized = array_slice($normalized, -DEVICES_HISTORY_LIMIT);
    }

    return array_values($normalized);
}

function devices_record_telemetry(array &$device, array $telemetry, int $timestamp): void
{
    if (!isset($device['heartbeatHistory']) || !is_array($device['heartbeatHistory'])) {
        $device['heartbeatHistory'] = [];
    }

    $statusInput = [];
    if (isset($telemetry['status']) && is_array($telemetry['status'])) {
        $statusInput = $telemetry['status'];
    }
    foreach (array_keys(DEVICES_STATUS_FIELD_CONFIG) as $key) {
        if (isset($telemetry[$key]) && !isset($statusInput[$key])) {
            $statusInput[$key] = $telemetry[$key];
        }
    }
    foreach (['network', 'errors'] as $key) {
        if (isset($telemetry[$key]) && !isset($statusInput[$key])) {
            $statusInput[$key] = $telemetry[$key];
        }
    }

    $metricsInput = [];
    if (isset($telemetry['metrics']) && is_array($telemetry['metrics'])) {
        $metricsInput = $telemetry['metrics'];
    }

    foreach (array_keys(DEVICES_METRIC_FIELD_CONFIG) as $key) {

        if (isset($telemetry[$key]) && !isset($metricsInput[$key])) {
            $metricsInput[$key] = $telemetry[$key];
        }
    }

    $status = devices_sanitize_status($statusInput);
    $metrics = devices_sanitize_metrics($metricsInput);
    $offlineFlag = array_key_exists('offline', $telemetry) ? (bool) $telemetry['offline'] : false;


    if (!empty($status)) {
        $device['status'] = $status;
    }
    if (!empty($metrics)) {
        $device['metrics'] = $metrics;
    }

    $history = devices_sanitize_history($device['heartbeatHistory']);
    $history[] = array_filter([
        'ts' => $timestamp,
        'offline' => $offlineFlag,
        'status' => !empty($status) ? $status : null,
        'metrics' => !empty($metrics) ? $metrics : null,
    ], static function ($value) {
        return $value !== null;
    });

    if (count($history) > DEVICES_HISTORY_LIMIT) {
        $history = array_slice($history, -DEVICES_HISTORY_LIMIT);
    }

    $device['heartbeatHistory'] = $history;
}

function devices_extract_telemetry_payload(array $payload): array
{
    $telemetry = [];

    $status = [];
    foreach (array_keys(DEVICES_STATUS_FIELD_CONFIG) as $key) {
        if (isset($payload[$key])) {
            $status[$key] = $payload[$key];
        }
    }
    if (isset($payload['status']) && is_array($payload['status'])) {
        $status = array_merge($payload['status'], $status);
    }
    if (isset($payload['network'])) {
        if (!isset($status['network'])) {
            $status['network'] = $payload['network'];
        } elseif (is_array($status['network']) && is_array($payload['network'])) {
            $status['network'] = array_merge($payload['network'], $status['network']);
        }
    }
    if (!empty($status)) {
        $telemetry['status'] = $status;
    }

    $metrics = [];
    if (isset($payload['metrics']) && is_array($payload['metrics'])) {
        $metrics = $payload['metrics'];
    }
    foreach (array_keys(DEVICES_METRIC_FIELD_CONFIG) as $key) {
        if (isset($payload[$key]) && !isset($metrics[$key])) {
            $metrics[$key] = $payload[$key];
        }
    }
    if (!empty($metrics)) {
        $telemetry['metrics'] = $metrics;
    }

    if (isset($payload['errors']) && is_array($payload['errors'])) {
        $telemetry['errors'] = $payload['errors'];
    } elseif (isset($payload['status']['errors']) && is_array($payload['status']['errors'])) {
        $telemetry['errors'] = $payload['status']['errors'];
    }

    if (array_key_exists('offline', $payload)) {
        $telemetry['offline'] = (bool) $payload['offline'];
    } elseif (array_key_exists('online', $payload)) {
        $telemetry['offline'] = !(bool) $payload['online'];
    }

    return $telemetry;
}

function devices_path(): string
{
    $custom = getenv('DEVICES_PATH');
    if (is_string($custom) && $custom !== '') {
        return $custom;
    }
    if (!empty($_ENV['DEVICES_PATH'])) {
        return $_ENV['DEVICES_PATH'];
    }
    return signage_data_path('devices.json');
}

function devices_sqlite_path(): string
{
    $custom = getenv('DEVICES_SQLITE_PATH');
    if (is_string($custom) && $custom !== '') {
        return $custom;
    }
    if (!empty($_ENV['DEVICES_SQLITE_PATH'])) {
        return (string) $_ENV['DEVICES_SQLITE_PATH'];
    }
    return signage_data_path('devices.sqlite');
}

function devices_pdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $path = devices_sqlite_path();
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 02775, true) && !is_dir($dir)) {
        throw new RuntimeException('Unable to create devices storage directory: ' . $dir);
    }

    try {
        $pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $exception) {
        throw new RuntimeException('Unable to open devices database: ' . $exception->getMessage(), 0, $exception);
    }

    $pdo->exec('PRAGMA journal_mode = ' . DEVICES_SQLITE_JOURNAL_MODE);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA busy_timeout = ' . DEVICES_SQLITE_BUSY_TIMEOUT_MS);

    devices_initialize_schema($pdo);

    @chmod($path, 0660);
    @chown($path, 'www-data');
    @chgrp($path, 'www-data');

    return $pdo;
}

function devices_initialize_schema(PDO $pdo): void
{
    $pdo->exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    $pdo->exec('CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        last_seen INTEGER,
        last_seen_at INTEGER
    )');
    $pdo->exec('CREATE TABLE IF NOT EXISTS pairings (
        code TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        created INTEGER
    )');
}

function devices_state_is_empty(array $state): bool
{
    return empty($state['devices']) && empty($state['pairings']);
}

function devices_encode_row(array $row): string
{
    $json = json_encode($row, DEVICES_STORAGE_JSON_FLAGS);
    if ($json === false) {
        throw new RuntimeException('Failed to encode devices payload');
    }
    return $json;
}

function devices_load_legacy_json(): ?array
{
    $path = devices_path();
    if (!is_file($path)) {
        return null;
    }
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') {
        return null;
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return null;
    }
    return devices_normalize_state($decoded);
}

function devices_load_from_sqlite(PDO $pdo): array
{
    $state = devices_default_state();

    $metaStmt = $pdo->prepare('SELECT value FROM meta WHERE key = :key');
    if ($metaStmt !== false && $metaStmt->execute([':key' => 'version'])) {
        $version = $metaStmt->fetchColumn();
        if ($version !== false) {
            $state['version'] = (int) $version;
        }
    }

    $devices = [];
    foreach ($pdo->query('SELECT id, data FROM devices') as $row) {
        $decoded = json_decode($row['data'], true);
        if (!is_array($decoded)) {
            continue;
        }
        $devices[$row['id']] = $decoded;
    }
    $state['devices'] = $devices;

    $pairings = [];
    foreach ($pdo->query('SELECT code, data FROM pairings') as $row) {
        $decoded = json_decode($row['data'], true);
        if (!is_array($decoded)) {
            continue;
        }
        $pairings[$row['code']] = $decoded;
    }
    $state['pairings'] = $pairings;

    return devices_normalize_state($state);
}

function devices_default_state(): array
{
    return [
        'version' => 1,
        'pairings' => [],
        'devices' => [],
    ];
}

function devices_normalize_device_id($value): string
{
    if (!is_string($value)) {
        return '';
    }
    $id = strtolower(trim($value));
    return preg_match(DEVICES_ID_PATTERN, $id) ? $id : '';
}

function devices_is_valid_id(string $id): bool
{
    return preg_match(DEVICES_ID_PATTERN, $id) === 1;
}

function devices_normalize_code($value): string
{
    if (!is_string($value)) {
        return '';
    }
    $code = strtoupper(trim($value));
    return preg_match(DEVICES_CODE_PATTERN, $code) ? $code : '';
}

function devices_normalize_state($state): array
{
    $normalized = devices_default_state();
    if (!is_array($state)) {
        return $normalized;
    }

    if (isset($state['version'])) {
        $normalized['version'] = (int) $state['version'];
    }

    foreach ($state as $key => $value) {
        if ($key === 'devices' || $key === 'pairings') {
            continue;
        }
        $normalized[$key] = $value;
    }

    if (isset($state['pairings']) && is_array($state['pairings'])) {
        foreach ($state['pairings'] as $code => $row) {
            if (!is_array($row)) {
                continue;
            }
            $normalizedCode = devices_normalize_code($row['code'] ?? $code);
            if ($normalizedCode === '') {
                continue;
            }
            $entry = $row;
            $entry['code'] = $normalizedCode;
            $entry['created'] = isset($entry['created']) ? (int) $entry['created'] : time();
            if (isset($entry['deviceId'])) {
                $deviceId = devices_normalize_device_id($entry['deviceId']);
                $entry['deviceId'] = $deviceId !== '' ? $deviceId : null;
            }
            $normalized['pairings'][$normalizedCode] = $entry;
        }
    }

    if (isset($state['devices']) && is_array($state['devices'])) {
        foreach ($state['devices'] as $key => $row) {
            if (!is_array($row)) {
                continue;
            }
            $id = devices_normalize_device_id($row['id'] ?? $key);
            if ($id === '') {
                continue;
            }
            $device = $row;
            $device['id'] = $id;
            if (!isset($device['name']) || !is_string($device['name'])) {
                $device['name'] = $id;
            }
            if (isset($device['created'])) {
                $device['created'] = (int) $device['created'];
            }
            if (isset($device['lastSeen'])) {
                $device['lastSeen'] = (int) $device['lastSeen'];
            }
            if (isset($device['lastSeenAt'])) {
                $device['lastSeenAt'] = (int) $device['lastSeenAt'];
            }
            if (!isset($device['overrides']) || !is_array($device['overrides'])) {
                $device['overrides'] = [];
            }
            $status = devices_sanitize_status($device['status'] ?? []);
            if (!empty($status)) {
                $device['status'] = $status;
            } else {
                unset($device['status']);
            }
            $metrics = devices_sanitize_metrics($device['metrics'] ?? []);
            if (!empty($metrics)) {
                $device['metrics'] = $metrics;
            } else {
                unset($device['metrics']);
            }
            $history = devices_sanitize_history($device['heartbeatHistory'] ?? []);
            if (!empty($history)) {
                $device['heartbeatHistory'] = $history;
            } else {
                unset($device['heartbeatHistory']);
            }
            $normalized['devices'][$id] = $device;
        }
    }

    return $normalized;
}

function devices_load(): array
{
    $pdo = devices_pdo();
    $state = devices_load_from_sqlite($pdo);
    if (!devices_state_is_empty($state)) {
        return $state;
    }

    $legacy = devices_load_legacy_json();
    if ($legacy !== null && !devices_state_is_empty($legacy)) {
        $copy = $legacy;
        devices_save($copy);
        return $copy;
    }

    return $state;
}

function devices_save(array &$db): bool
{
    $db = devices_normalize_state($db);
    $pdo = devices_pdo();

    try {
        $pdo->beginTransaction();

        $pdo->exec('DELETE FROM devices');
        $pdo->exec('DELETE FROM pairings');

        $insertDevice = $pdo->prepare('INSERT INTO devices (id, data, last_seen, last_seen_at) VALUES (:id, :data, :last_seen, :last_seen_at)');
        if ($insertDevice === false) {
            throw new RuntimeException('Failed to prepare device insert statement');
        }
        foreach ($db['devices'] as $id => $device) {
            $encoded = devices_encode_row($device);
            $insertDevice->execute([
                ':id' => $id,
                ':data' => $encoded,
                ':last_seen' => isset($device['lastSeen']) ? (int) $device['lastSeen'] : null,
                ':last_seen_at' => isset($device['lastSeenAt']) ? (int) $device['lastSeenAt'] : null,
            ]);
        }

        $insertPairing = $pdo->prepare('INSERT INTO pairings (code, data, created) VALUES (:code, :data, :created)');
        if ($insertPairing === false) {
            throw new RuntimeException('Failed to prepare pairing insert statement');
        }
        foreach ($db['pairings'] as $code => $pairing) {
            $encoded = devices_encode_row($pairing);
            $insertPairing->execute([
                ':code' => $code,
                ':data' => $encoded,
                ':created' => isset($pairing['created']) ? (int) $pairing['created'] : null,
            ]);
        }

        $metaStmt = $pdo->prepare('INSERT INTO meta (key, value) VALUES (:key, :value) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
        if ($metaStmt === false) {
            throw new RuntimeException('Failed to prepare metadata statement');
        }
        $metaStmt->execute([
            ':key' => 'version',
            ':value' => (string) ($db['version'] ?? 1),
        ]);

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw new RuntimeException('Unable to write device database', 0, $exception);
    }

    return true;
}

function devices_touch_entry(array &$db, $id, ?int $timestamp = null, array $telemetry = []): bool
{
    $normalizedId = devices_normalize_device_id($id);
    if ($normalizedId === '' || !isset($db['devices'][$normalizedId]) || !is_array($db['devices'][$normalizedId])) {
        return false;
    }
    $ts = $timestamp ?? time();
    $db['devices'][$normalizedId]['lastSeen'] = $ts;
    $db['devices'][$normalizedId]['lastSeenAt'] = $ts;
    if (!empty($telemetry)) {
        devices_record_telemetry($db['devices'][$normalizedId], $telemetry, $ts);
    }
    return true;
}

function devices_touch_entry_persistent($id, ?int $timestamp = null, array $telemetry = []): bool
{
    $normalizedId = devices_normalize_device_id((string) $id);
    if ($normalizedId === '') {
        return false;
    }

    $pdo = devices_pdo();

    try {
        $pdo->beginTransaction();

        $select = $pdo->prepare('SELECT data FROM devices WHERE id = :id LIMIT 1');
        if ($select === false) {
            throw new RuntimeException('Failed to prepare device lookup statement');
        }
        $select->execute([':id' => $normalizedId]);
        $row = $select->fetch(PDO::FETCH_ASSOC);
        if ($row === false) {
            $pdo->rollBack();
            return false;
        }

        $device = json_decode($row['data'], true);
        if (!is_array($device)) {
            $device = ['id' => $normalizedId];
        }

        $state = devices_normalize_state(['devices' => [$normalizedId => $device]]);
        $device = $state['devices'][$normalizedId];

        $ts = $timestamp ?? time();
        $device['lastSeen'] = $ts;
        $device['lastSeenAt'] = $ts;
        if (!empty($telemetry)) {
            devices_record_telemetry($device, $telemetry, $ts);
        }

        $encoded = devices_encode_row($device);
        $update = $pdo->prepare('UPDATE devices SET data = :data, last_seen = :last_seen, last_seen_at = :last_seen_at WHERE id = :id');
        if ($update === false) {
            throw new RuntimeException('Failed to prepare device update statement');
        }
        $update->execute([
            ':id' => $normalizedId,
            ':data' => $encoded,
            ':last_seen' => isset($device['lastSeen']) ? (int) $device['lastSeen'] : null,
            ':last_seen_at' => isset($device['lastSeenAt']) ? (int) $device['lastSeenAt'] : null,
        ]);

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw new RuntimeException('Failed to update device heartbeat', 0, $exception);
    }

    return true;
}

// Koppel-Code (AAAAAA) aus A–Z (ohne I/O) generieren; keine Speicherung hier
function dev_gen_code($db)
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    for ($i = 0; $i < 500; $i++) {
        $code = '';
        for ($j = 0; $j < 6; $j++) {
            $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }
        if (empty($db['pairings'][$code])) {
            return $code;
        }
    }
    return null;
}

// Geräte-ID im Format dev_ + 12 hex (Regex im Player erwartet exakt das)
function dev_gen_id($db)
{
    for ($i = 0; $i < 1000; $i++) {
        $id = 'dev_' . bin2hex(random_bytes(6));
        if (empty($db['devices'][$id])) {
            return $id;
        }
    }
    return null;
}

// Aufräumen: offene Pairings >15min löschen; verwaiste Links bereinigen
function dev_gc(&$db)
{
    $db = devices_normalize_state($db);
    $now = time();
    foreach (($db['pairings'] ?? []) as $code => $p) {
        $age = $now - (int) ($p['created'] ?? $now);
        if ($age > 900 && empty($p['deviceId'])) {
            unset($db['pairings'][$code]);
        }
        // Referenz auf nicht-existentes Device? -> lösen
        if (!empty($p['deviceId']) && empty($db['devices'][$p['deviceId']])) {
            $db['pairings'][$code]['deviceId'] = null;
        }
    }
}
