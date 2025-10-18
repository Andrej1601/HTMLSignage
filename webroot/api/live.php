<?php
declare(strict_types=1);

require_once __DIR__ . '/../admin/api/storage.php';
require_once __DIR__ . '/../admin/api/devices_store.php';
require_once __DIR__ . '/../admin/api/device_resolver.php';

set_time_limit(0);
ignore_user_abort(true);

header('Content-Type: text/event-stream; charset=UTF-8');
header('Cache-Control: no-cache, no-transform');
header('Connection: keep-alive');

define('LIVE_JSON_FLAGS', JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);

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
    $meta = ['mtime' => 0, 'hash' => null];
    if (!is_file($path)) {
        return $meta;
    }
    clearstatcache(false, $path);
    $mtime = @filemtime($path);
    if ($mtime !== false) {
        $meta['mtime'] = (int) $mtime;
    }
    $hash = @sha1_file($path);
    if ($hash !== false) {
        $meta['hash'] = $hash;
    }
    return $meta;
}

function live_build_global_state(): array
{
    $schedule = signage_read_json('schedule.json');
    $settings = signage_read_json('settings.json');
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

function live_build_device_state(string $deviceId): array
{
    $error = null;
    $payload = devices_resolve_payload($deviceId, $error);
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

$paths = [];
if ($watchGlobals || $watchDevice) {
    $paths['settings'] = signage_data_path('settings.json');
    $paths['schedule'] = signage_data_path('schedule.json');
}
if ($watchDevice || $watchPair) {
    $paths['devices'] = devices_path();
}

$meta = [];
foreach ($paths as $key => $path) {
    $meta[$key] = live_file_meta($path);
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
    live_send_event('state', live_build_global_state());
}

$lastDeviceState = null;
if ($watchDevice) {
    $deviceState = live_build_device_state($deviceId);
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
while (!connection_aborted()) {
    clearstatcache();
    $configChanged = false;
    $devicesChanged = false;

    foreach ($paths as $key => $path) {
        $current = live_file_meta($path);
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

    if ($configChanged && $watchGlobals) {
        live_send_event('state', live_build_global_state());
    }

    if ($devicesChanged) {
        if ($watchDevice) {
            $deviceState = live_build_device_state($deviceId);
            if ($deviceState !== $lastDeviceState) {
                $lastDeviceState = $deviceState;
                live_send_event('device', $deviceState);
            }
        }
        if ($watchPair) {
            $pairState = live_resolve_pairing($pairCode);
            if ($pairState !== $lastPairState) {
                $lastPairState = $pairState;
                live_send_event('pair', $pairState);
            }
        }
    }

    $now = time();
    if (($now - $lastPing) >= 25) {
        live_send_event('ping', ['ok' => true, 'now' => $now]);
        $lastPing = $now;
    }

    usleep(500000);
}
