<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../webroot/admin/api/storage.php';

final class JsonFlagsTest extends TestCase
{
    public function testResponseFlagsProduceCompactJson(): void
    {
        $payload = ['ok' => true, 'data' => ['value' => 42]];
        $json = json_encode($payload, SIGNAGE_JSON_RESPONSE_FLAGS);
        $expected = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $this->assertSame($expected, $json);
        $this->assertStringNotContainsString("\n", $json);
    }

    public function testStorageFlagsPreservePrettyPrint(): void
    {
        $payload = ['ok' => true, 'data' => ['value' => 42]];
        $json = json_encode($payload, SIGNAGE_JSON_STORAGE_FLAGS);

        $this->assertNotFalse($json);
        $this->assertStringContainsString("\n", $json);
    }
}
