<?php
// Authentifizierungs- und Autorisierungshelfer
// MIGRATED TO SESSION AUTH - Wrapper for backwards compatibility

declare(strict_types=1);

require_once __DIR__ . '/users_store.php';
require_once __DIR__ . '/session_manager.php';

const SIGNAGE_AUTH_REALM = 'HTMLSignage Admin';

/**
 * Check if auth is enabled
 * Always return true since we now use session auth
 */
function auth_is_enabled(): bool
{
    return true;
}

/**
 * Get current authenticated user from session
 */
function auth_get_request_user(): ?array
{
    static $resolved = null;
    if ($resolved !== null) {
        return $resolved;
    }

    // Check session auth
    if (session_check_remember_token() || session_is_authenticated()) {
        $resolved = session_get_user();
        return $resolved;
    }

    $resolved = null;
    return null;
}

/**
 * Send 401 Unauthorized - redirect to login instead of HTTP Basic Auth
 */
function auth_send_unauthorized(): void
{
    // For API calls: return JSON
    if (str_contains($_SERVER['REQUEST_URI'] ?? '', '/api/')) {
        http_response_code(401);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'ok' => false,
            'error' => 'auth-required',
            'message' => 'Authentication required',
        ], SIGNAGE_JSON_RESPONSE_FLAGS);
        exit;
    }

    // For page requests: redirect to login
    $loginUrl = '/admin/login.php';
    $returnUrl = $_SERVER['REQUEST_URI'] ?? '/admin/';
    header('Location: ' . $loginUrl . '?return=' . urlencode($returnUrl));
    exit;
}

/**
 * Send 403 Forbidden
 */
function auth_send_forbidden(): void
{
    http_response_code(403);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'ok' => false,
        'error' => 'forbidden',
        'message' => 'Insufficient permissions',
    ], SIGNAGE_JSON_RESPONSE_FLAGS);
    exit;
}

/**
 * Require specific role (backwards compatibility)
 */
function auth_require_role(string $role): array
{
    $user = auth_get_request_user();

    if ($user === null) {
        auth_send_unauthorized();
    }

    $roleName = auth_normalize_role_name($role);
    if ($roleName === null) {
        auth_send_forbidden();
    }

    if (!auth_user_has_role($user, $roleName)) {
        auth_send_forbidden();
    }

    return $user;
}

/**
 * Require specific permission
 */
function auth_require_permission(string $permission): array
{
    $user = auth_get_request_user();

    if ($user === null) {
        auth_send_unauthorized();
    }

    $permissionName = auth_normalize_permission_name($permission);
    if ($permissionName === null) {
        auth_send_forbidden();
    }

    $permissions = auth_user_permissions($user);
    if (!in_array($permissionName, $permissions, true)) {
        auth_send_forbidden();
    }

    return $user;
}

/**
 * Check if user has permission
 */
function auth_user_has_permission(array $user, string $permission): bool
{
    $permissionName = auth_normalize_permission_name($permission);
    if ($permissionName === null) {
        return false;
    }

    $permissions = auth_user_permissions($user);
    return in_array($permissionName, $permissions, true);
}

// Deprecated functions - kept for backwards compatibility
function auth_resolve_basic_credentials(): ?array
{
    return null; // Not used anymore
}

function auth_rate_limit_identifier(): string
{
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

function auth_rate_limit_guard(string $key): void
{
    // No-op - rate limiting handled by session manager
}

function auth_rate_limit_register_failure(string $key): void
{
    // No-op
}

function auth_rate_limit_clear(string $key): void
{
    // No-op
}
