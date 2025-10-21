<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../webroot/admin/api/storage.php';

final class SignageApiCacheTest extends TestCase
{
    protected function tearDown(): void
    {
        parent::tearDown();
        unset($_SERVER['HTTP_IF_NONE_MATCH'], $_SERVER['HTTP_IF_MODIFIED_SINCE']);
        if (function_exists('header_remove')) {
            header_remove();
        }
    }

    public function testScheduleEndpointProvidesCachingHeaders(): void
    {
        $result = $this->runEndpoint(__DIR__ . '/../../webroot/api/schedule.php');

        $this->assertSame(200, $result['status']);
        $this->assertNotSame('', $result['body']);

        $cacheControl = $this->getHeader($result['headers'], 'Cache-Control');
        $this->assertNotNull($cacheControl);
        $this->assertStringContainsString('max-age=30', $cacheControl);

        $etag = $this->getHeader($result['headers'], 'ETag');
        $this->assertNotNull($etag);
        $this->assertNotSame('', $etag);

        $lastModified = $this->getHeader($result['headers'], 'Last-Modified');
        $this->assertNotNull($lastModified);
        $this->assertNotSame('', $lastModified);
    }

    public function testScheduleEndpointReturns304ForMatchingEtag(): void
    {
        $initial = $this->runEndpoint(__DIR__ . '/../../webroot/api/schedule.php');
        $etag = $this->getHeader($initial['headers'], 'ETag');
        $this->assertNotNull($etag);

        $_SERVER['HTTP_IF_NONE_MATCH'] = $etag;

        $result = $this->runEndpoint(__DIR__ . '/../../webroot/api/schedule.php');

        $this->assertSame(304, $result['status']);
        $this->assertSame('', $result['body']);
        $this->assertSame($etag, $this->getHeader($result['headers'], 'ETag'));
    }

    public function testSettingsEndpointReturns304ForLastModified(): void
    {
        $initial = $this->runEndpoint(__DIR__ . '/../../webroot/api/settings.php');
        $lastModified = $this->getHeader($initial['headers'], 'Last-Modified');
        $this->assertNotNull($lastModified);

        $_SERVER['HTTP_IF_MODIFIED_SINCE'] = $lastModified;

        $result = $this->runEndpoint(__DIR__ . '/../../webroot/api/settings.php');

        $this->assertSame(304, $result['status']);
        $this->assertSame('', $result['body']);
        $this->assertSame($lastModified, $this->getHeader($result['headers'], 'Last-Modified'));
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
        include $script;
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
