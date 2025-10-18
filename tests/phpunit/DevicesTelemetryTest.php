<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../webroot/admin/api/devices_store.php';

final class DevicesTelemetryTest extends TestCase
{
    public function testExtractTelemetryPayloadMergesStatusAndMetrics(): void
    {
        $payload = [
            'firmware' => '1.2.3',
            'status' => [
                'network' => [
                    'ssid' => 'SpaWifi',
                    'quality' => 88,
                ]
            ],
            'metrics' => [
                'cpuLoad' => '34.5'
            ],
            'online' => false,
            'errors' => [
                ['code' => 'WIFI', 'message' => 'Weak signal']
            ]
        ];

        $telemetry = devices_extract_telemetry_payload($payload);

        $this->assertTrue($telemetry['offline']);
        $this->assertSame('1.2.3', $telemetry['status']['firmware']);
        $this->assertSame('SpaWifi', $telemetry['status']['network']['ssid']);
        $this->assertSame(88, $telemetry['status']['network']['quality']);
        $this->assertSame(34.5, $telemetry['metrics']['cpuLoad']);
        $this->assertCount(1, $telemetry['errors']);
    }

    public function testRecordTelemetryUpdatesDeviceState(): void
    {
        $device = [];
        $telemetry = [
            'status' => [
                'firmware' => ' 1.0.0 ',
                'network' => [
                    'type' => 'wifi',
                    'ssid' => 'SpaWifi',
                    'quality' => 140,
                    'rssi' => -44.2
                ]
            ],
            'metrics' => [
                'cpuLoad' => '55.4',
                'temperature' => 42
            ],
            'offline' => true
        ];

        devices_record_telemetry($device, $telemetry, 1700000000);

        $this->assertSame('1.0.0', $device['status']['firmware']);
        $this->assertSame('SpaWifi', $device['status']['network']['ssid']);
        $this->assertSame(100, $device['status']['network']['quality']);
        $this->assertSame(-44, $device['status']['network']['rssi']);
        $this->assertSame(55.4, $device['metrics']['cpuLoad']);
        $this->assertCount(1, $device['heartbeatHistory']);
        $this->assertTrue($device['heartbeatHistory'][0]['offline']);
    }

    public function testDeviceIdNormalizationRejectsInvalidValues(): void
    {
        $this->assertSame('dev_abcdef123456', devices_normalize_device_id('DEV_ABCDEF123456'));
        $this->assertSame('', devices_normalize_device_id('invalid-device'));
    }
}
