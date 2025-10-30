<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../webroot/admin/api/storage.php';

final class SettingsPermissionTest extends TestCase
{
    public function testModuleSystemGrantsAccess(): void
    {
        $this->assertTrue(signage_permissions_allow_settings(['module-system']));
    }

    public function testSlideshowDisplayPermissionGrantsAccess(): void
    {
        $this->assertTrue(signage_permissions_allow_settings(['slideshow-display']));
    }

    public function testDesignTypographyPermissionGrantsAccess(): void
    {
        $this->assertTrue(signage_permissions_allow_settings(['design-typography']));
    }

    public function testUnrelatedPermissionDoesNotGrantAccess(): void
    {
        $this->assertFalse(signage_permissions_allow_settings(['content-media']));
    }
}
