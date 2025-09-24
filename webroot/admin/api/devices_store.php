<?php
// /admin/api/devices_store.php – gemeinsame Helfer für Geräte-Datenbank
// Wird von Heartbeat- und Admin-APIs genutzt. Pfade werden zentral über
// devices_path() bestimmt, um harte Pfadangaben zu vermeiden.

declare(strict_types=1);

require_once __DIR__ . '/storage.php';

const DEVICES_ID_PATTERN = '/^dev_[a-f0-9]{12}$/';
const DEVICES_CODE_PATTERN = '/^[A-Z]{6}$/';

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

function devices_touch_entry(array &$db, $id, ?int $timestamp = null): bool
{
    $normalizedId = devices_normalize_device_id($id);
    if ($normalizedId === '' || !isset($db['devices'][$normalizedId]) || !is_array($db['devices'][$normalizedId])) {
        return false;
    }
    $ts = $timestamp ?? time();
    $db['devices'][$normalizedId]['lastSeen'] = $ts;
    $db['devices'][$normalizedId]['lastSeenAt'] = $ts;
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
