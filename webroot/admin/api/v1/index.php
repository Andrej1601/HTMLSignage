<?php
declare(strict_types=1);

/**
 * HTMLSignage API v1
 * RESTful API entry point
 *
 * Modern PHP 8.3+ API with:
 * - RESTful routes
 * - Type safety
 * - JSON responses
 * - Proper HTTP status codes
 * - CORS support
 */

// Error handling
error_reporting(E_ALL);
ini_set('display_errors', '0');
ini_set('log_errors', '1');

// Autoload classes (simple autoloader)
spl_autoload_register(function ($class) {
    $prefix = 'HTMLSignage\\API\\V1\\';
    $baseDir = __DIR__ . '/';

    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    $relativeClass = substr($class, $len);
    $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';

    if (file_exists($file)) {
        require $file;
    }
});

use HTMLSignage\API\V1\Router;
use HTMLSignage\API\V1\Response;
use HTMLSignage\API\V1\Middleware\AuthMiddleware;
use HTMLSignage\API\V1\Controllers\ScheduleController;
use HTMLSignage\API\V1\Controllers\SettingsController;
use HTMLSignage\API\V1\Controllers\DeviceController;
use HTMLSignage\API\V1\Controllers\AssetController;

// Create router
$router = new Router();

// ========================================
// Middleware
// ========================================

// CORS Middleware
$router->use(function ($method, $path) {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    if ($method === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    return true;
});

// Auth Middleware
$router->use([AuthMiddleware::class, 'handle']);

// JSON Content-Type Middleware
$router->use(function ($method, $path) {
    if (!in_array($method, ['GET', 'DELETE', 'OPTIONS'])) {
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        if (strpos($contentType, 'multipart/form-data') === false &&
            strpos($contentType, 'application/json') === false) {
            // Allow non-JSON for file uploads
            if ($path !== '/assets/upload') {
                Response::error('Content-Type must be application/json', 415);
                return false;
            }
        }
    }
    return true;
});

// ========================================
// Routes - Schedule
// ========================================
$scheduleController = new ScheduleController();

$router->get('/schedule', [$scheduleController, 'index']);
$router->post('/schedule', [$scheduleController, 'save']);
$router->get('/schedule/export', [$scheduleController, 'export']);
$router->post('/schedule/import', [$scheduleController, 'import']);

// ========================================
// Routes - Settings
// ========================================
$settingsController = new SettingsController();

$router->get('/settings', [$settingsController, 'index']);
$router->patch('/settings', [$settingsController, 'update']);
$router->put('/settings', [$settingsController, 'replace']);

// ========================================
// Routes - Devices
// ========================================
$deviceController = new DeviceController();

$router->get('/devices', [$deviceController, 'index']);
$router->get('/devices/pending', [$deviceController, 'pending']);
$router->get('/devices/:id', [$deviceController, 'show']);
$router->post('/devices/pair', [$deviceController, 'createPairing']);
$router->post('/devices/:id/claim', [$deviceController, 'claim']);
$router->patch('/devices/:id', [$deviceController, 'update']);
$router->delete('/devices/:id', [$deviceController, 'destroy']);

// ========================================
// Routes - Assets
// ========================================
$assetController = new AssetController();

$router->post('/assets/upload', [$assetController, 'upload']);
$router->delete('/assets/:filename', [$assetController, 'destroy']);
$router->post('/assets/cleanup', [$assetController, 'cleanup']);

// ========================================
// Health Check
// ========================================
$router->get('/health', function ($params) {
    Response::success([
        'status' => 'healthy',
        'version' => '1.0.0',
        'timestamp' => time(),
        'php_version' => PHP_VERSION
    ]);
});

// ========================================
// Handle Request
// ========================================
try {
    $router->handle();
} catch (\Throwable $e) {
    error_log("Unhandled exception: " . $e->getMessage());
    Response::serverError('Internal server error');
}
