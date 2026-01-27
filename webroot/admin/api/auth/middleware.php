<?php
// API Authentication Middleware
// Include this at the top of all admin API endpoints that require authentication

declare(strict_types=1);

require_once __DIR__ . '/session_manager.php';

// Check if user is authenticated
if (!session_check_remember_token() && !session_is_authenticated()) {
    http_response_code(401);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'success' => false,
        'error' => 'unauthorized',
        'message' => 'Authentication required',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Get current user for permission checks
$_AUTH_USER = session_get_user();

if ($_AUTH_USER === null) {
    http_response_code(401);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'success' => false,
        'error' => 'user_not_found',
        'message' => 'User session invalid',
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Check if current user has permission
 */
function api_has_permission(string $permission): bool
{
    global $_AUTH_USER;

    if ($_AUTH_USER === null) {
        return false;
    }

    $permissions = auth_user_permissions($_AUTH_USER);
    return in_array($permission, $permissions, true);
}

/**
 * Require specific permission
 */
function api_require_permission(string $permission): void
{
    if (!api_has_permission($permission)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'error' => 'forbidden',
            'message' => 'Insufficient permissions',
            'required_permission' => $permission,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}

/**
 * Get current authenticated user
 */
function api_current_user(): array
{
    global $_AUTH_USER;
    return $_AUTH_USER;
}

/**
 * Verify CSRF token for POST/PUT/DELETE requests
 */
function api_verify_csrf(): void
{
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    // Only check for state-changing methods
    if (!in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
        return;
    }

    // Get CSRF token from header or body
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? null;

    if ($token === null) {
        // Try to get from JSON body
        $body = file_get_contents('php://input');
        $data = json_decode($body, true);
        $token = $data['csrf_token'] ?? null;
    }

    if ($token === null || !session_csrf_verify($token)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'error' => 'csrf_token_invalid',
            'message' => 'Invalid CSRF token',
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}
