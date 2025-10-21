<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../webroot/admin/api/storage.php';
require_once __DIR__ . '/../../webroot/admin/api/devices_store.php';

final class DevicesHeartbeatSqliteTest extends TestCase
{
    private static string $dbPath;

    public static function setUpBeforeClass(): void
    {
        self::$dbPath = sys_get_temp_dir() . '/signage-heartbeat-' . uniqid('', true) . '.db';
        putenv('SIGNAGE_DB_PATH=' . self::$dbPath);
        $_ENV['SIGNAGE_DB_PATH'] = self::$dbPath;
        @unlink(self::$dbPath);
    }

    public static function tearDownAfterClass(): void
    {
        if (isset(self::$dbPath)) {
            @unlink(self::$dbPath);
        }
    }

    protected function setUp(): void
    {
        if (!signage_db_available()) {
            $this->markTestSkipped('SQLite is not available in this environment.');
        }

        signage_db_bootstrap();
        $pdo = signage_db();
        $pdo->exec('DELETE FROM kv_store');

        $state = devices_default_state();
        signage_kv_set(DEVICES_STORAGE_KEY, $state);
    }

    public function testSqliteHeartbeatUpdatesDeviceState(): void
    {
        $deviceId = 'dev_abcdef123456';
        $state = signage_kv_get(DEVICES_STORAGE_KEY, []);
        $state['devices'][$deviceId] = [
            'id' => $deviceId,
            'name' => 'Spa Display',
            'lastSeen' => 100,
            'lastSeenAt' => 100,
            'heartbeatHistory' => [],
        ];
        $state['devices']['dev_ffffffffffff'] = [
            'id' => 'dev_ffffffffffff',
            'name' => 'Other Device',
            'lastSeen' => 50,
            'lastSeenAt' => 50,
        ];
        signage_kv_set(DEVICES_STORAGE_KEY, $state);

        $timestamp = 1700000000;
        $telemetry = [
            'offline' => true,
            'metrics' => [
                'cpuLoad' => 42,
            ],
        ];

        $result = devices_touch_entry_sqlite($deviceId, $timestamp, $telemetry);
        $this->assertTrue($result);

        $updated = signage_kv_get(DEVICES_STORAGE_KEY, []);
        $this->assertArrayHasKey($deviceId, $updated['devices']);
        $device = $updated['devices'][$deviceId];

        $this->assertSame($timestamp, $device['lastSeen']);
        $this->assertSame($timestamp, $device['lastSeenAt']);
        $this->assertSame($deviceId, $device['id']);
        $this->assertSame(42.0, $device['metrics']['cpuLoad']);
        $this->assertCount(1, $device['heartbeatHistory']);
        $this->assertTrue($device['heartbeatHistory'][0]['offline']);

        $other = $updated['devices']['dev_ffffffffffff'];
        $this->assertSame(50, $other['lastSeen']);
        $this->assertSame('Other Device', $other['name']);
    }

    public function testSqliteHeartbeatDoesNotTouchUnknownDevice(): void
    {
        $this->assertFalse(devices_touch_entry_sqlite('dev_deadbeef0000', time(), []));
    }
}
