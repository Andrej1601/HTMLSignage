<?php
// Gemeinsame Helfer zum Auflösen eines Geräte-Setups (Schedule + Settings)
// Wird von device_resolve.php und Live-Updates verwendet.

declare(strict_types=1);

require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/devices_store.php';

function devices_resolver_merge(array $base, array $override): array
{
    foreach ($override as $key => $value) {
        if (is_array($value) && array_key_exists($key, $base) && is_array($base[$key])) {
            $base[$key] = devices_resolver_merge($base[$key], $value);
        } else {
            $base[$key] = $value;
        }
    }
    return $base;
}

function devices_resolver_day_key(): string
{
    $map = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    $index = (int) date('w');
    return $map[$index] ?? 'Sun';
}

/**
 * Liefert aufgelöste Schedule/Settings für ein Gerät.
 *
 * @param string $deviceId Roh- oder Normalisierte Geräte-ID.
 * @param array|null $error Wird bei Fehlern mit ['status'=>int,'code'=>string] befüllt.
 * @return array|null
 */
function devices_resolve_payload(string $deviceId, ?array &$error = null): ?array
{
    $normalized = devices_normalize_device_id($deviceId);
    if ($normalized === '') {
        $error = ['status' => 400, 'code' => 'invalid-device-format'];
        return null;
    }

    $db = devices_load();
    $device = $db['devices'][$normalized] ?? null;
    if (!$device) {
        $error = ['status' => 404, 'code' => 'device-not-found'];
        return null;
    }

    $baseSettings = signage_read_json('settings.json');
    $baseSchedule = signage_read_json('schedule.json');
    $baseScheduleVersion = (int) ($baseSchedule['version'] ?? 0);

    $useOverrides = !empty($device['useOverrides']);
    $overSettings = [];
    $overSchedule = [];

    if ($useOverrides && isset($device['overrides']) && is_array($device['overrides'])) {
        if (isset($device['overrides']['settings']) && is_array($device['overrides']['settings'])) {
            $overSettings = $device['overrides']['settings'];
        }
        if (isset($device['overrides']['schedule']) && is_array($device['overrides']['schedule'])) {
            $overSchedule = $device['overrides']['schedule'];
        }
    }

    $mergedSettings = devices_resolver_merge(is_array($baseSettings) ? $baseSettings : [], $overSettings);

    // Preset-Felder aus Basiskonfig übernehmen, falls Overrides sie leeren
    if (!array_key_exists('presetAuto', $overSettings) || $overSettings['presetAuto'] === null || $overSettings['presetAuto'] === '') {
        if (array_key_exists('presetAuto', $baseSettings)) {
            $mergedSettings['presetAuto'] = $baseSettings['presetAuto'];
        }
    }
    if (!array_key_exists('presets', $overSettings) || !is_array($overSettings['presets']) || count($overSettings['presets']) === 0) {
        if (array_key_exists('presets', $baseSettings) && is_array($baseSettings['presets'])) {
            $mergedSettings['presets'] = $baseSettings['presets'];
        }
    }

    $schedule = is_array($baseSchedule) ? $baseSchedule : [];
    if (!empty($mergedSettings['presetAuto']) && !empty($mergedSettings['presets']) && is_array($mergedSettings['presets'])) {
        $presets = $mergedSettings['presets'];
        $dayKey = devices_resolver_day_key();
        $preset = $presets[$dayKey] ?? ($presets['Default'] ?? null);
        if (is_array($preset) && isset($preset['saunas']) && isset($preset['rows']) && is_array($preset['rows'])) {
            $schedule = $preset;
        }
    }

    if ($useOverrides && !empty($overSchedule)) {
        $schedule = devices_resolver_merge($schedule, $overSchedule);
        $schedule['version'] = (int) ($overSchedule['version'] ?? 0);
    } else {
        $schedule['version'] = $baseScheduleVersion;
    }

    if ($useOverrides && array_key_exists('version', $overSettings)) {
        $mergedSettings['version'] = (int) $overSettings['version'];
    } else {
        $mergedSettings['version'] = (int) ($baseSettings['version'] ?? 0);
    }

    $deviceName = $device['name'] ?? $normalized;
    if (!is_string($deviceName) || $deviceName === '') {
        $deviceName = $normalized;
    }

    return [
        'device' => [
            'id' => $normalized,
            'name' => $deviceName,
        ],
        'settings' => $mergedSettings,
        'schedule' => $schedule,
        'meta' => [
            'settingsVersion' => (int) ($mergedSettings['version'] ?? 0),
            'scheduleVersion' => (int) ($schedule['version'] ?? 0),
            'baseSettingsVersion' => (int) ($baseSettings['version'] ?? 0),
            'baseScheduleVersion' => $baseScheduleVersion,
            'overridesActive' => $useOverrides,
        ],
    ];
}
