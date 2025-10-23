<?php
declare(strict_types=1);

http_response_code(200);
if (function_exists('header_remove')) {
    @header_remove('Content-Type');
}
header('Content-Type: text/event-stream; charset=UTF-8');
header('Content-Disposition: inline');
header('Cache-Control: no-cache, no-transform', true);
header('Connection: keep-alive', true);
header('X-Accel-Buffering: no', true);
header('X-Content-Type-Options: nosniff', true);

require_once __DIR__ . '/../admin/api/storage.php';
require_once __DIR__ . '/../admin/api/devices_store.php';
require_once __DIR__ . '/../admin/api/device_resolver.php';

set_time_limit(0);
ignore_user_abort(true);

if (function_exists('ini_set')) {
    @ini_set('zlib.output_compression', '0');
    @ini_set('implicit_flush', '1');
    @ini_set('output_buffering', '0');
}

while (ob_get_level() > 0) {
    @ob_end_clean();
}
@ob_implicit_flush(true);

define('LIVE_JSON_FLAGS', JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
const LIVE_META_CACHE_TTL_MICROS = 1_000_000;
const LIVE_FILE_META_TTL_MICROS = 1_000_000;
const LIVE_POLL_BASE_MICROS = 500_000;
const LIVE_POLL_MAX_MICROS = 15_000_000;
const LIVE_POLL_BACKOFF_FACTOR = 1.6;
const LIVE_POLL_JITTER_MAX = 250_000;

function live_cached_meta(string $cacheKey, callable $resolver, int $ttlMicros = LIVE_META_CACHE_TTL_MICROS): array
{
    static $cache = [];
    $nowMicros = (int) floor(microtime(true) * 1_000_000);
    $entry = $cache[$cacheKey] ?? null;
    if (is_array($entry)
        && isset($entry['value'], $entry['expires'])
        && is_int($entry['expires'])
        && $entry['expires'] > $nowMicros
    ) {
        return is_array($entry['value']) ? $entry['value'] : [];
    }

    $value = $resolver();
    if (!is_array($value)) {
        $value = [];
    }

    $cache[$cacheKey] = [
        'expires' => $nowMicros + max($ttlMicros, 0),
        'value' => $value,
    ];

    return $value;
}

function live_send_event(string $event, $data): void
{
    echo 'event: ' . $event . "\n";
    if ($data !== null) {
        $json = json_encode($data, LIVE_JSON_FLAGS);
        if ($json === false) {
            $json = json_encode(['ok' => false, 'error' => 'encode-failed'], LIVE_JSON_FLAGS);
        }
        echo 'data: ' . $json . "\n\n";
    } else {
        echo "data: null\n\n";
    }
    @ob_flush();
    @flush();
}

function live_file_meta(string $path): array
{
    return live_cached_meta('file:' . $path, function () use ($path): array {
        $meta = ['mtime' => 0, 'hash' => null];
        if (!is_file($path)) {
            return $meta;
        }
        clearstatcache(false, $path);
        $mtime = @filemtime($path);
        if ($mtime !== false) {
            $meta['mtime'] = (int) $mtime;
        }
        $size = @filesize($path);
        if ($size !== false) {
            $meta['hash'] = $meta['mtime'] . ':' . (int) $size;
        }
        return $meta;
    }, LIVE_FILE_META_TTL_MICROS);
}

function live_load_globals(): array
{
    return [
        'schedule' => signage_read_json('schedule.json'),
        'settings' => signage_read_json('settings.json'),
    ];
}

function live_build_global_state(?array $globals = null): array
{
    if ($globals === null) {
        $globals = live_load_globals();
    }
    $schedule = $globals['schedule'] ?? [];
    $settings = $globals['settings'] ?? [];
    return [
        'ok' => true,
        'schedule' => $schedule,
        'settings' => $settings,
        'meta' => [
            'scheduleVersion' => (int) ($schedule['version'] ?? 0),
            'settingsVersion' => (int) ($settings['version'] ?? 0),
        ],
        'now' => time(),
    ];
}

function live_build_device_state(string $deviceId, ?array $globals = null): array
{
    $error = null;
    if ($globals === null) {
        $globals = live_load_globals();
    }
    $baseSettings = $globals['settings'] ?? null;
    $baseSchedule = $globals['schedule'] ?? null;
    $payload = devices_resolve_payload($deviceId, $error, is_array($baseSettings) ? $baseSettings : null, is_array($baseSchedule) ? $baseSchedule : null);
    if ($payload === null) {
        return [
            'ok' => false,
            'error' => $error['code'] ?? 'resolve-failed',
            'status' => $error['status'] ?? 500,
            'device' => ['id' => devices_normalize_device_id($deviceId) ?: $deviceId],
            'now' => time(),
        ];
    }
    return [
        'ok' => true,
        'device' => $payload['device'],
        'settings' => $payload['settings'],
        'schedule' => $payload['schedule'],
        'meta' => $payload['meta'] ?? [],
        'now' => time(),
    ];
}

function live_resolve_pairing(string $code): array
{
    $state = devices_load();
    $entry = $state['pairings'][$code] ?? null;
    $deviceId = is_array($entry) ? ($entry['deviceId'] ?? null) : null;
    $normalizedDevice = $deviceId ? devices_normalize_device_id($deviceId) : '';
    $paired = $normalizedDevice !== '';
    return [
        'ok' => true,
        'code' => $code,
        'paired' => $paired,
        'deviceId' => $paired ? $normalizedDevice : null,
        'exists' => $entry !== null,
        'now' => time(),
    ];
}

$deviceParam = $_GET['device'] ?? '';
$pairParam = $_GET['pair'] ?? '';

$deviceParam = is_string($deviceParam) ? trim($deviceParam) : '';
$pairParam = is_string($pairParam) ? trim($pairParam) : '';

$deviceId = '';
if ($deviceParam !== '') {
    $deviceId = devices_normalize_device_id($deviceParam);
    if ($deviceId === '') {
        http_response_code(400);
        live_send_event('error', ['ok' => false, 'error' => 'invalid-device']);
        exit;
    }
}

$pairCode = '';
if ($pairParam !== '') {
    $pairCode = devices_normalize_code($pairParam);
    if ($pairCode === '') {
        http_response_code(400);
        live_send_event('error', ['ok' => false, 'error' => 'invalid-pair-code']);
        exit;
    }
}

$watchGlobals = ($deviceId === '' && $pairCode === '');
$watchDevice = $deviceId !== '';
$watchPair = $pairCode !== '';

$metaResolvers = [];
if (signage_db_available()) {
    if ($watchGlobals || $watchDevice) {
        $metaResolvers['settings'] = function (): array {
            return live_cached_meta('kv:settings', function (): array {
                return signage_kv_meta(SIGNAGE_SETTINGS_STORAGE_KEY);
            });
        };
        $metaResolvers['schedule'] = function (): array {
            return live_cached_meta('kv:schedule', function (): array {
                return signage_kv_meta(SIGNAGE_SCHEDULE_STORAGE_KEY);
            });
        };
    }
    if ($watchDevice || $watchPair) {
        $metaResolvers['devices'] = function (): array {
            return live_cached_meta('kv:devices', function (): array {
                return signage_kv_meta(DEVICES_STORAGE_KEY);
            });
        };
    }
} else {
    if ($watchGlobals || $watchDevice) {
        $settingsPath = signage_data_path('settings.json');
        $schedulePath = signage_data_path('schedule.json');
        $metaResolvers['settings'] = function () use ($settingsPath): array {
            return live_file_meta($settingsPath);
        };
        $metaResolvers['schedule'] = function () use ($schedulePath): array {
            return live_file_meta($schedulePath);
        };
    }
    if ($watchDevice || $watchPair) {
        $devicesPath = devices_path();
        $metaResolvers['devices'] = function () use ($devicesPath): array {
            return live_file_meta($devicesPath);
        };
    }
}

$meta = [];
foreach ($metaResolvers as $key => $resolver) {
    $meta[$key] = $resolver();
}

$currentGlobals = null;
if ($watchGlobals || $watchDevice) {
    $currentGlobals = live_load_globals();
}

echo "retry: 5000\n\n";
@ob_flush();
@flush();

live_send_event('ready', [
    'globals' => $watchGlobals,
    'device' => $watchDevice ? $deviceId : null,
    'pair' => $watchPair ? $pairCode : null,
]);

if ($watchGlobals) {
    live_send_event('state', live_build_global_state($currentGlobals));
}

$lastDeviceState = null;
if ($watchDevice) {
    $deviceState = live_build_device_state($deviceId, $currentGlobals);
    $lastDeviceState = $deviceState;
    live_send_event('device', $deviceState);
}

$lastPairState = null;
if ($watchPair) {
    $pairState = live_resolve_pairing($pairCode);
    $lastPairState = $pairState;
    live_send_event('pair', $pairState);
}

$lastPing = time();
$basePollInterval = LIVE_POLL_BASE_MICROS;
$pollInterval = $basePollInterval;
$maxPollInterval = LIVE_POLL_MAX_MICROS;

while (!connection_aborted()) {
    $configChanged = false;
    $devicesChanged = false;

    foreach ($metaResolvers as $key => $resolver) {
        $current = $resolver();
        $previous = $meta[$key] ?? ['mtime' => 0, 'hash' => null];
        if ($current['mtime'] !== $previous['mtime'] || $current['hash'] !== $previous['hash']) {
            $meta[$key] = $current;
            if ($key === 'devices') {
                $devicesChanged = true;
            } else {
                $configChanged = true;
            }
        }
    }

    if ($configChanged && ($watchGlobals || $watchDevice)) {
        $currentGlobals = live_load_globals();
    }

    if ($configChanged && $watchGlobals) {
        live_send_event('state', live_build_global_state($currentGlobals));
    }

    $shouldRefreshDevice = ($configChanged && $watchDevice) || ($devicesChanged && $watchDevice);
    if ($shouldRefreshDevice) {
        if ($currentGlobals === null) {
            $currentGlobals = live_load_globals();
        }
        $deviceState = live_build_device_state($deviceId, $currentGlobals);
        if ($deviceState !== $lastDeviceState) {
            $lastDeviceState = $deviceState;
            live_send_event('device', $deviceState);
        }
    }

    if ($devicesChanged && $watchPair) {
        $pairState = live_resolve_pairing($pairCode);
        if ($pairState !== $lastPairState) {
            $lastPairState = $pairState;
            live_send_event('pair', $pairState);
        }
    }

    $now = time();
    if (($now - $lastPing) >= 25) {
        live_send_event('ping', ['ok' => true, 'now' => $now]);
        $lastPing = $now;
    }

    if ($configChanged || $devicesChanged) {
        $pollInterval = $basePollInterval;
    } else {
        $nextInterval = (int) max($basePollInterval, (int) ($pollInterval * LIVE_POLL_BACKOFF_FACTOR));
        if ($nextInterval > $maxPollInterval) {
            $nextInterval = $maxPollInterval;
        }
        $pollInterval = $nextInterval;
    }

    $sleepMicros = $pollInterval;
    if ($pollInterval > $basePollInterval && LIVE_POLL_JITTER_MAX > 0) {
        try {
            $sleepMicros = min($maxPollInterval, $pollInterval + random_int(0, LIVE_POLL_JITTER_MAX));
        } catch (\Throwable $randomError) {
            $sleepMicros = min($maxPollInterval, $pollInterval + mt_rand(0, LIVE_POLL_JITTER_MAX));
        }
    }

    if ($sleepMicros > 0) {
        usleep($sleepMicros);
    }
}
