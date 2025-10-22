#!/usr/bin/env php
<?php
declare(strict_types=1);

require_once __DIR__ . '/../webroot/admin/api/storage.php';
require_once __DIR__ . '/../webroot/admin/api/devices_store.php';

function heartbeat_usage(): void
{
    echo "Usage: php scripts/heartbeat_load_test.php [--count=N] [--devices=M] [--reset]\n";
    echo "       Use SIGNAGE_DB_PATH to target a specific SQLite database.\n";
    exit(1);
}

$options = [
    'count' => 1000,
    'devices' => 25,
    'reset' => false,
];

foreach (array_slice($_SERVER['argv'] ?? [], 1) as $arg) {
    if ($arg === '--help' || $arg === '-h') {
        heartbeat_usage();
    }
    if ($arg === '--reset') {
        $options['reset'] = true;
        continue;
    }
    if (str_starts_with($arg, '--count=')) {
        $value = substr($arg, 8);
        if (!ctype_digit($value)) {
            fwrite(STDERR, "Invalid --count value\n");
            exit(1);
        }
        $options['count'] = max(1, (int) $value);
        continue;
    }
    if (str_starts_with($arg, '--devices=')) {
        $value = substr($arg, 10);
        if (!ctype_digit($value)) {
            fwrite(STDERR, "Invalid --devices value\n");
            exit(1);
        }
        $options['devices'] = max(1, (int) $value);
        continue;
    }

    fwrite(STDERR, "Unknown argument: {$arg}\n");
    heartbeat_usage();
}

if (!signage_db_available()) {
    fwrite(STDERR, "SQLite backend not available. Install php-sqlite3 and configure SIGNAGE_DB_PATH.\n");
    exit(1);
}

try {
    signage_db_bootstrap();
} catch (Throwable $exception) {
    fwrite(STDERR, 'Unable to initialize SQLite backend: ' . $exception->getMessage() . "\n");
    exit(1);
}

$pdo = signage_db();
$pdo->exec('PRAGMA synchronous = NORMAL');
$pdo->exec('PRAGMA cache_size = -40000');

if ($options['reset']) {
    $pdo->exec('DELETE FROM kv_store');
}

$state = signage_kv_get(DEVICES_STORAGE_KEY, devices_default_state());
$state = is_array($state) ? $state : devices_default_state();

if (!isset($state['devices']) || !is_array($state['devices'])) {
    $state['devices'] = [];
}

$deviceIds = array_keys($state['devices']);

if ($options['reset'] || count($deviceIds) < $options['devices']) {
    $state = devices_default_state();
    for ($i = 0; $i < $options['devices']; $i++) {
        $deviceId = sprintf('dev_%012x', $i + 1);
        $state['devices'][$deviceId] = [
            'id' => $deviceId,
            'name' => 'Load Test #' . ($i + 1),
            'lastSeen' => time(),
            'lastSeenAt' => time(),
            'heartbeatHistory' => [],
        ];
        $deviceIds[$i] = $deviceId;
    }
    signage_kv_set(DEVICES_STORAGE_KEY, $state);
} else {
    $deviceIds = array_values(array_slice($deviceIds, 0, $options['devices']));
}

$count = $options['count'];
$start = microtime(true);
$failures = 0;
$errors = [];

for ($i = 0; $i < $count; $i++) {
    $deviceId = $deviceIds[$i % count($deviceIds)];
    $timestamp = time();
    $telemetry = [
        'metrics' => [
            'cpuLoad' => ($i % 100) / 2,
            'memoryUsage' => ($i % 100) / 1.5,
        ],
        'status' => [
            'ip' => '10.0.0.' . (($i % 200) + 1),
        ],
    ];

    try {
        $ok = devices_touch_entry_sqlite($deviceId, $timestamp, $telemetry);
    } catch (Throwable $exception) {
        $failures++;
        $errors[] = $exception->getMessage();
        continue;
    }

    if ($ok !== true) {
        $failures++;
    }
}

$duration = max(microtime(true) - $start, 0.0001);
$perSecond = $count / $duration;

printf("Heartbeats: %d\n", $count);
printf("Devices: %d\n", count($deviceIds));
printf("Failures: %d\n", $failures);
printf("Duration: %.3f s\n", $duration);
printf("Throughput: %.2f heartbeats/s\n", $perSecond);

if ($errors) {
    $unique = array_slice(array_unique($errors), 0, 5);
    echo "Errors:\n";
    foreach ($unique as $message) {
        echo "  - {$message}\n";
    }
}
