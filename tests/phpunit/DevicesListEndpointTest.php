<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class DevicesListEndpointTest extends TestCase
{
    protected function tearDown(): void
    {
        parent::tearDown();
        unset($_SERVER['HTTP_IF_NONE_MATCH'], $_SERVER['HTTP_IF_MODIFIED_SINCE']);
        if (function_exists('header_remove')) {
            header_remove();
        }
    }

    public function testDevicesListProvidesCachingHeaders(): void
    {
        $result = $this->runEndpoint(__DIR__ . '/../../webroot/admin/api/devices_list.php');

        $this->assertSame(200, $result['status']);
        $this->assertNotSame('', $result['body']);

        $cacheControl = $this->getHeader($result['headers'], 'Cache-Control');
        $this->assertNotNull($cacheControl);
        $this->assertStringContainsString('private', $cacheControl);

        $etag = $this->getHeader($result['headers'], 'ETag');
        $this->assertNotNull($etag);
        $this->assertNotSame('', $etag);

        $payload = json_decode($result['body'], true);
        $this->assertIsArray($payload);
        $this->assertArrayHasKey('ok', $payload);
        $this->assertTrue($payload['ok']);
        $this->assertArrayHasKey('pairings', $payload);
        $this->assertArrayHasKey('devices', $payload);
    }

    public function testDevicesListRespectsIfNoneMatch(): void
    {
        $initial = $this->runEndpoint(__DIR__ . '/../../webroot/admin/api/devices_list.php');
        $etag = $this->getHeader($initial['headers'], 'ETag');
        $this->assertNotNull($etag);

        $_SERVER['HTTP_IF_NONE_MATCH'] = $etag;

        $result = $this->runEndpoint(__DIR__ . '/../../webroot/admin/api/devices_list.php');

        $this->assertSame(304, $result['status']);
        $this->assertSame('', $result['body']);
        $this->assertSame($etag, $this->getHeader($result['headers'], 'ETag'));
    }

    /**
     * @return array{status:int,body:string,headers:array<int,string>}
     */
    private function runEndpoint(string $script): array
    {
        if (function_exists('header_remove')) {
            header_remove();
        }

        http_response_code(200);

        ob_start();
        require $script;
        $body = ob_get_clean();

        $status = http_response_code();
        $headers = headers_list();

        if (function_exists('header_remove')) {
            header_remove();
        }

        return [
            'status' => $status,
            'body' => $body,
            'headers' => $headers,
        ];
    }

    private function getHeader(array $headers, string $name): ?string
    {
        foreach ($headers as $header) {
            if (stripos($header, $name . ':') === 0) {
                return trim(substr($header, strlen($name) + 1));
            }
        }

        return null;
    }
}
