<?php
// /admin/api/auth/users_list.php – liefert Benutzer & Rollen (ohne Passworthashes)

declare(strict_types=1);

require_once __DIR__ . '/guard.php';

auth_require_permission('user-admin');

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$state = auth_users_load();
$users = [];
foreach ($state['users'] as $user) {
    if (!is_array($user)) {
        continue;
    }
    $users[] = auth_users_public_payload($user);
}

usort($users, static function (array $a, array $b): int {
    return strcmp($a['username'] ?? '', $b['username'] ?? '');
});

echo json_encode([
    'ok' => true,
    'users' => $users,
    'roles' => array_values(SIGNAGE_AUTH_ROLES),
    'permissions' => array_values(SIGNAGE_AUTH_PERMISSIONS),
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
