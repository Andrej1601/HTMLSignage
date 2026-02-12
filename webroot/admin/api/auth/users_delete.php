<?php
// /admin/api/auth/users_delete.php – Benutzer entfernen

declare(strict_types=1);

require_once __DIR__ . '/guard.php';

auth_require_permission('user-admin');

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

function auth_users_delete_error(string $error, int $status = 400): void
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $error]);
    exit;
}

$raw = file_get_contents('php://input') ?: '';
$payload = json_decode($raw, true);
if (!is_array($payload)) {
    $payload = [];
}

$username = $payload['username'] ?? ($_POST['username'] ?? '');
if (!is_string($username)) {
    $username = '';
}
$username = strtolower(trim($username));
if ($username === '') {
    auth_users_delete_error('username-required', 422);
}

$state = auth_users_load();
if (!isset($state['users'][$username])) {
    auth_users_delete_error('user-not-found', 404);
}

if (auth_is_protected_user($username)) {
    auth_users_delete_error('protected-admin', 409);
}

if (auth_user_has_role($state['users'][$username], 'admin') && auth_users_count_admins($state, $username) === 0) {
    auth_users_delete_error('last-admin', 409);
}

try {
    if (!auth_users_remove($username)) {
        auth_users_delete_error('user-not-found', 404);
    }
} catch (RuntimeException $exception) {
    if ($exception->getMessage() === 'protected-user') {
        auth_users_delete_error('protected-admin', 409);
    }
    auth_users_delete_error('user-not-found', 404);
}

auth_audit('user.delete', [
    'username' => $username,
]);

echo json_encode(['ok' => true], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
