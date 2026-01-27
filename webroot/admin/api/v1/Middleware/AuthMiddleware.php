<?php
declare(strict_types=1);

namespace HTMLSignage\API\V1\Middleware;

use HTMLSignage\API\V1\Response;

require_once __DIR__ . '/../../auth/guard.php';

/**
 * Authentication Middleware
 * Handles HTTP Basic Auth
 */
class AuthMiddleware
{
    /**
     * Check authentication
     */
    public static function handle(string $method, string $path): bool
    {
        // Skip auth for health check
        if ($path === '/health') {
            return true;
        }

        // Check if auth is enabled
        if (!auth_is_enabled()) {
            return true; // No auth required
        }

        // Get authenticated user
        $user = auth_get_request_user();

        if ($user === null) {
            // Send WWW-Authenticate header
            header('WWW-Authenticate: Basic realm="' . SIGNAGE_AUTH_REALM . '", charset="UTF-8"');
            Response::unauthorized('Authentication required');
            return false;
        }

        // Check role for write operations
        if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'])) {
            $role = $user['role'] ?? 'viewer';

            if (!in_array($role, ['editor', 'admin'])) {
                Response::error('Insufficient permissions', 403);
                return false;
            }
        }

        // Store user in global context for controllers
        $GLOBALS['authenticated_user'] = $user;

        return true;
    }
}
