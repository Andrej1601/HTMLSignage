<?php
// Authentifizierungs- und Autorisierungshelfer

declare(strict_types=1);

require_once __DIR__ . '/users_store.php';

const SIGNAGE_AUTH_REALM = 'HTMLSignage Admin';

function auth_is_enabled(): bool
{
    static $cached = null;
    if ($cached === null) {
        $state = auth_users_load();
        $cached = !empty($state['users']);
    }
    return $cached;
}

function auth_resolve_basic_credentials(): ?array
{
    $user = $_SERVER['PHP_AUTH_USER'] ?? null;
    $pass = $_SERVER['PHP_AUTH_PW'] ?? null;
    if ($user !== null) {
        return ['username' => (string) $user, 'password' => (string) $pass];
    }
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['Authorization'] ?? null;
    if (!$header || stripos($header, 'Basic ') !== 0) {
        return null;
    }
    $decoded = base64_decode(substr($header, 6), true);
    if (!$decoded) {
        return null;
    }
    if (!str_contains($decoded, ':')) {
        return null;
    }
    [$username, $password] = explode(':', $decoded, 2);
    return ['username' => $username, 'password' => $password];
}

function auth_get_request_user(): ?array
{
    static $resolved = null;
    if ($resolved !== null) {
        return $resolved;
    }
    if (!auth_is_enabled()) {
        $resolved = null;
        return null;
    }
    $credentials = auth_resolve_basic_credentials();
    if (!$credentials || $credentials['username'] === '') {
        $resolved = null;
        return null;
    }
    $user = auth_users_find($credentials['username']);
    if (!$user || empty($user['password'])) {
        $resolved = null;
        return null;
    }
    if (!auth_verify_password($credentials['password'] ?? '', (string) $user['password'])) {
        $resolved = null;
        return null;
    }
    $resolved = $user;
    return $resolved;
}

function auth_send_unauthorized(): void
{
    header('WWW-Authenticate: Basic realm="' . SIGNAGE_AUTH_REALM . '", charset="UTF-8"');
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'auth-required']);
    exit;
}

function auth_send_forbidden(): void
{
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'forbidden']);
    exit;
}

function auth_require_role(string $role): array
{
    if (!auth_is_enabled()) {
        return ['username' => 'system', 'roles' => ['admin']];
    }
    $user = auth_get_request_user();
    if ($user === null) {
        auth_send_unauthorized();
    }
    if (!auth_user_has_role($user, $role)) {
        auth_send_forbidden();
    }
    auth_register_last_user($user);
    return $user;
}

function auth_register_last_user(array $user): void
{
    $GLOBALS['__signage_auth_last_user'] = $user;
}

function auth_current_user(): ?array
{
    return $GLOBALS['__signage_auth_last_user'] ?? auth_get_request_user();
}

function auth_audit(string $event, array $context = []): void
{
    $user = auth_current_user();
    if ($user) {
        $context['user'] = $user['username'];
    }
    auth_append_audit($event, $context);
}
