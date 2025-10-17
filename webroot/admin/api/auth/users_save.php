<?php
// /admin/api/auth/users_save.php – Benutzer anlegen oder aktualisieren

declare(strict_types=1);

require_once __DIR__ . '/guard.php';

auth_require_permission('user-admin');

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

function auth_users_send_error(string $error, int $status = 400): void
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $error]);
    exit;
}

$raw = file_get_contents('php://input') ?: '';
$payload = json_decode($raw, true);
if (!is_array($payload)) {
    auth_users_send_error('invalid-payload', 400);
}

$username = strtolower(trim((string) ($payload['username'] ?? '')));
if ($username === '') {
    auth_users_send_error('username-required', 422);
}

$displayName = trim((string) ($payload['displayName'] ?? ''));
$rolesInput = $payload['roles'] ?? [];
if (is_string($rolesInput)) {
    $rolesInput = preg_split('/[,\s]+/', $rolesInput) ?: [];
}

$roles = [];
if (is_array($rolesInput)) {
    foreach ($rolesInput as $role) {
        $roleName = auth_normalize_role_name((string) $role);
        if ($roleName === null) {
            continue;
        }
        if (!in_array($roleName, $roles, true)) {
            $roles[] = $roleName;
        }
    }
}
if (!$roles) {
    $roles[] = SIGNAGE_AUTH_DEFAULT_ROLE;
}

$permissionsInput = $payload['permissions'] ?? null;
$permissions = auth_normalize_permissions($permissionsInput, $roles);

$state = auth_users_load();
$current = $state['users'][$username] ?? null;
$wasAdmin = $current ? auth_user_has_role($current, 'admin') : false;
$willBeAdmin = in_array('admin', $roles, true);

if (auth_is_protected_user($username) && !$willBeAdmin) {
    auth_users_send_error('protected-admin', 409);
}

if ($wasAdmin && !$willBeAdmin && auth_users_count_admins($state, $username) === 0) {
    auth_users_send_error('last-admin', 409);
}

if (!$current && auth_users_count_admins($state) === 0 && !$willBeAdmin) {
    auth_users_send_error('needs-admin', 409);
}

$password = $payload['password'] ?? '';
if (!is_string($password)) {
    $password = '';
}

$user = [
    'username' => $username,
    'roles' => $roles,
    'displayName' => $displayName !== '' ? $displayName : null,
    'permissions' => $permissions,
];

if ($password !== '') {
    $user['password'] = auth_hash_password($password);
}

auth_users_set($user);
auth_audit('user.save', [
    'username' => $username,
    'roles' => $roles,
    'displayName' => $displayName !== '' ? $displayName : null,
    'resetPassword' => $password !== '',
]);

$updated = auth_users_find($username);
if (!$updated) {
    auth_users_send_error('user-not-found', 500);
}

$public = auth_users_public_payload($updated);

echo json_encode([
    'ok' => true,
    'user' => $public,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
