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

function devices_sanitize_network($value): array
{
    if (!is_array($value)) {
        return [];
    }

    $network = [];
    $type = devices_optional_string($value['type'] ?? $value['interface'] ?? null, 40);
    if ($type !== null) {
        $network['type'] = $type;
    }
    $ssid = devices_optional_string($value['ssid'] ?? $value['networkName'] ?? null, 64);
    if ($ssid !== null) {
        $network['ssid'] = $ssid;
    }

    foreach (['quality', 'signalQuality', 'linkQuality', 'strength'] as $candidate) {
        if (!isset($value[$candidate]) || !is_numeric($value[$candidate])) {
            continue;
        }
        $quality = max(0, min(100, (int) round((float) $value[$candidate])));
        $network['quality'] = $quality;
        break;
    }

    $signalCaptured = false;
    foreach (['signal', 'dbm', 'wifiSignal', 'strength', 'rssi'] as $candidate) {
        if (!isset($value[$candidate]) || !is_numeric($value[$candidate])) {
            continue;
        }
        $signal = (float) $value[$candidate];
        $network['signal'] = $signal;
        if ($candidate === 'rssi') {
            $network['rssi'] = (int) round($signal);
        }
        $signalCaptured = true;
        break;
    }

    if (!$signalCaptured && isset($value['rssi']) && is_numeric($value['rssi'])) {
        $network['signal'] = (float) $value['rssi'];
        $network['rssi'] = (int) round((float) $value['rssi']);
    } elseif (!isset($network['rssi']) && isset($value['rssi']) && is_numeric($value['rssi'])) {
        $network['rssi'] = (int) round((float) $value['rssi']);
    }

    if (isset($value['latency']) && is_numeric($value['latency'])) {
        $network['latency'] = max(0, (float) $value['latency']);
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
    $metrics = [];
    $map = [
        'cpuLoad' => ['cpuLoad', 'cpu', 'cpu_usage', 'cpuPercent', 'cpuLoadPercent'],
        'memoryUsage' => ['memoryUsage', 'memory', 'ram', 'memoryPercent', 'memUsage', 'ramUsage'],
        'storageFree' => ['storageFree', 'storage_free', 'storageFreeMb', 'diskFree', 'diskFreeMb', 'freeStorage'],
        'storageUsed' => ['storageUsed', 'storage_used', 'storageUsedMb', 'diskUsed', 'diskUsedMb', 'usedStorage'],
        'temperature' => ['temperature', 'temp', 'temperatureC', 'tempC'],
        'uptime' => ['uptime', 'upTimeSeconds', 'uptimeSeconds', 'uptimeSec'],
        'batteryLevel' => ['battery', 'batteryLevel', 'batteryPercent', 'battery_level'],
        'latency' => ['latency', 'ping']

    ];

    foreach ($map as $target => $candidates) {
        foreach ($candidates as $candidate) {
            if (!array_key_exists($candidate, $value)) {
                continue;
            }
            $raw = $value[$candidate];
            if (!is_numeric($raw)) {
                continue;
            }
            $metrics[$target] = (float) $raw;
            break;
        }
    }

    return $metrics;
}

function devices_sanitize_status($value): array
{
    if (!is_array($value)) {
        return [];
    }

    $status = [];

    $firmware = devices_optional_string($value['firmware'] ?? $value['version'] ?? null, 100);
    if ($firmware !== null) {
        $status['firmware'] = $firmware;
    }

    $appVersion = devices_optional_string($value['appVersion'] ?? $value['player'] ?? null, 100);
    if ($appVersion !== null) {
        $status['appVersion'] = $appVersion;
    }

    $ip = devices_optional_string($value['ip'] ?? $value['address'] ?? null, 64);
    if ($ip !== null) {
        $status['ip'] = $ip;
    }

    $notes = devices_optional_string($value['notes'] ?? null, 180);
    if ($notes !== null) {
        $status['notes'] = $notes;
    }

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
    foreach (['firmware', 'ip', 'network', 'errors', 'notes', 'appVersion'] as $key) {
        if (isset($telemetry[$key]) && !isset($statusInput[$key])) {
            $statusInput[$key] = $telemetry[$key];
        }
    }

    $metricsInput = [];
    if (isset($telemetry['metrics']) && is_array($telemetry['metrics'])) {
        $metricsInput = $telemetry['metrics'];
    }

    foreach (['cpuLoad', 'memoryUsage', 'storageFree', 'storageUsed', 'temperature', 'uptime', 'batteryLevel', 'latency'] as $key) {

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
    foreach (['firmware', 'appVersion', 'ip', 'notes'] as $key) {
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
    foreach (['cpuLoad', 'memoryUsage', 'storageFree', 'storageUsed', 'temperature', 'uptime', 'batteryLevel'] as $key) {
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
    $path = devices_path();
    if (!is_file($path)) {
        return devices_default_state();
    }
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') {
        return devices_default_state();
    }
    $decoded = json_decode($raw, true);
    return devices_normalize_state($decoded);
}

function devices_save(array &$db): bool
{
    $db = devices_normalize_state($db);
    $path = devices_path();
    @mkdir(dirname($path), 02775, true);
    $json = json_encode($db, SIGNAGE_JSON_FLAGS);
    $bytes = @file_put_contents($path, $json, LOCK_EX);
    if ($bytes === false) {
        throw new RuntimeException('Unable to write device database');
    }
    @chmod($path, 0644);
    @chown($path, 'www-data');
    @chgrp($path, 'www-data');
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
