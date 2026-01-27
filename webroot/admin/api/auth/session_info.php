<?php
// Session Info API - Returns current session information
declare(strict_types=1);

require_once __DIR__ . '/middleware.php';

header('Content-Type: application/json; charset=UTF-8');

$user = api_current_user();

echo json_encode([
    'success' => true,
    'session' => [
        'authenticated' => true,
        'username' => $user['username'] ?? null,
        'displayName' => $user['displayName'] ?? null,
        'roles' => auth_user_roles($user),
        'permissions' => auth_user_permissions($user),
        'login_time' => $_SESSION['login_time'] ?? null,
        'last_activity' => $_SESSION['last_activity'] ?? null,
        'remembered' => $_SESSION['remembered'] ?? false,
    ],
    'csrf_token' => session_csrf_token(),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
