<?php
declare(strict_types=1);

/**
 * Legacy API Compatibility Proxy
 *
 * Routes old API calls to new v1 endpoints
 * Allows gradual frontend migration
 *
 * Mapping:
 * - /admin/api/load.php          → GET  /api/v1/schedule
 * - /admin/api/save.php          → POST /api/v1/schedule
 * - /admin/api/load_settings.php → GET  /api/v1/settings
 * - /admin/api/devices_list.php  → GET  /api/v1/devices
 * - /admin/api/upload.php        → POST /api/v1/assets/upload
 */

require_once __DIR__ . '/v1/Router.php';
require_once __DIR__ . '/v1/Response.php';

use HTMLSignage\API\V1\Router;
use HTMLSignage\API\V1\Response;

/**
 * Proxy request to new API
 */
function proxy_to_v1(string $method, string $endpoint, ?array $body = null): void
{
    $url = 'http://localhost:8080/admin/api/v1' . $endpoint;

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);

    // Forward auth headers
    if (isset($_SERVER['PHP_AUTH_USER'])) {
        curl_setopt($ch, CURLOPT_USERPWD, $_SERVER['PHP_AUTH_USER'] . ':' . ($_SERVER['PHP_AUTH_PW'] ?? ''));
    } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: ' . $_SERVER['HTTP_AUTHORIZATION']
        ]);
    }

    // Send body if provided
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, array_merge(
            curl_getopt($ch, CURLOPT_HTTPHEADER) ?? [],
            ['Content-Type: application/json']
        ));
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body));
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    http_response_code($httpCode);
    header('Content-Type: application/json; charset=UTF-8');
    echo $response;
}

/**
 * Convert legacy response to new format if needed
 */
function legacy_to_v1_response(array $data): array
{
    // If already in new format, return as-is
    if (isset($data['success'])) {
        return $data;
    }

    // Convert old format to new
    return [
        'success' => true,
        'message' => 'OK',
        'data' => $data
    ];
}

/**
 * Route mapping helper
 */
function get_legacy_route_mapping(): array
{
    return [
        'load.php' => ['method' => 'GET', 'endpoint' => '/schedule'],
        'save.php' => ['method' => 'POST', 'endpoint' => '/schedule'],
        'load_settings.php' => ['method' => 'GET', 'endpoint' => '/settings'],
        'devices_list.php' => ['method' => 'GET', 'endpoint' => '/devices'],
        'devices_pending.php' => ['method' => 'GET', 'endpoint' => '/devices/pending'],
        'upload.php' => ['method' => 'POST', 'endpoint' => '/assets/upload'],
        'export.php' => ['method' => 'GET', 'endpoint' => '/schedule/export'],
        'import.php' => ['method' => 'POST', 'endpoint' => '/schedule/import'],
    ];
}
