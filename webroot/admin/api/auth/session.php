<?php
declare(strict_types=1);

require_once __DIR__ . '/../storage.php';
require_once __DIR__ . '/guard.php';

header('Content-Type: application/json; charset=UTF-8');

if (!auth_is_enabled()) {
    echo json_encode([
        'ok' => true,
        'user' => [
            'username' => null,
            'displayName' => null,
            'roles' => ['admin']
        ]
    ], SIGNAGE_JSON_FLAGS);
    exit;
}

$user = auth_require_role('viewer');
$roles = auth_user_roles($user);
$displayName = '';
if (!empty($user['displayName']) && is_string($user['displayName'])) {
    $displayName = $user['displayName'];
} elseif (!empty($user['display']) && is_string($user['display'])) {
    $displayName = $user['display'];
}

echo json_encode([
    'ok' => true,
    'user' => [
        'username' => $user['username'] ?? null,
        'displayName' => $displayName !== '' ? $displayName : null,
        'roles' => $roles
    ]
], SIGNAGE_JSON_FLAGS);
