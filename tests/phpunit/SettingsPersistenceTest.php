<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../webroot/admin/api/storage.php';

final class SettingsPersistenceTest extends TestCase
{
    private array $originalSettings;

    protected function setUp(): void
    {
        parent::setUp();
        $this->originalSettings = signage_settings_load();
    }

    protected function tearDown(): void
    {
        $ok = signage_settings_save($this->originalSettings, $error);
        if (!$ok) {
            throw new RuntimeException('Unable to restore settings in tearDown: ' . ($error ?? 'unknown'));
        }
        parent::tearDown();
    }

    public function testTypographyAndLayoutPersist(): void
    {
        $modified = $this->originalSettings;
        $modified['fonts']['scale'] = 2.5;
        $modified['fonts']['h1Scale'] = 3.1;
        $modified['fonts']['overviewTimeScale'] = 2.4;
        $modified['display']['layoutMode'] = 'split';
        $modified['display']['layoutProfile'] = 'triple';
        $modified['display']['rightWidthPercent'] = 44;

        $ok = signage_settings_save($modified, $error);
        $this->assertTrue($ok, $error ?? 'failed to save settings');

        $reloaded = signage_settings_load();

        $this->assertSame('split', $reloaded['display']['layoutMode']);
        $this->assertSame('triple', $reloaded['display']['layoutProfile']);
        $this->assertSame(44, $reloaded['display']['rightWidthPercent']);
        $this->assertEqualsWithDelta(2.5, (float) ($reloaded['fonts']['scale'] ?? 0), 0.0001);
        $this->assertEqualsWithDelta(3.1, (float) ($reloaded['fonts']['h1Scale'] ?? 0), 0.0001);
        $this->assertEqualsWithDelta(2.4, (float) ($reloaded['fonts']['overviewTimeScale'] ?? 0), 0.0001);
    }
}
