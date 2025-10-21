<?php
// Authentifizierungs- und Autorisierungshelfer

declare(strict_types=1);

require_once __DIR__ . '/users_store.php';

const SIGNAGE_AUTH_REALM = 'HTMLSignage Admin';
const SIGNAGE_AUTH_RATE_LIMIT_MAX_FAILURES = 5;
const SIGNAGE_AUTH_RATE_LIMIT_WINDOW = 300; // 5 minutes
const SIGNAGE_AUTH_RATE_LIMIT_LOCKOUT = 900; // 15 minutes

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
    $rateLimitKey = auth_rate_limit_identifier();
    auth_rate_limit_guard($rateLimitKey);
    $credentials = auth_resolve_basic_credentials();
    if (!$credentials || $credentials['username'] === '') {
        $resolved = null;
        return null;
    }
    $user = auth_users_find($credentials['username']);
    if (!$user || empty($user['password'])) {
        $resolved = null;
        auth_rate_limit_register_failure($rateLimitKey);
        return null;
    }
    if (!auth_verify_password($credentials['password'] ?? '', (string) $user['password'])) {
        $resolved = null;
        auth_rate_limit_register_failure($rateLimitKey);
        return null;
    }
    auth_rate_limit_clear($rateLimitKey);
    $resolved = $user;
    return $resolved;
}

function auth_send_unauthorized(): void
{
    header('WWW-Authenticate: Basic realm="' . SIGNAGE_AUTH_REALM . '", charset="UTF-8"');
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'auth-required'], SIGNAGE_JSON_RESPONSE_FLAGS);
    exit;
}

function auth_send_forbidden(): void
{
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'forbidden'], SIGNAGE_JSON_RESPONSE_FLAGS);
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

function auth_user_has_permission(array $user, string $permission): bool
{
    $permissionName = auth_normalize_permission_name($permission);
    if ($permissionName === null) {
        return false;
    }
    $granted = auth_user_permissions($user);
    return in_array($permissionName, $granted, true);
}

function auth_require_permission(string $permission): array
{
    if (!auth_is_enabled()) {
        return ['username' => 'system', 'roles' => ['admin']];
    }
    $user = auth_get_request_user();
    if ($user === null) {
        auth_send_unauthorized();
    }
    if (!auth_user_has_permission($user, $permission)) {
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

function auth_rate_limit_identifier(): string
{
    if (!auth_is_enabled()) {
        return '';
    }
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (!is_string($ip) || $ip === '') {
        return '';
    }
    return 'ip:' . $ip;
}

function auth_rate_limit_state(): array
{
    if (!isset($GLOBALS['__signage_auth_rate_limit_state'])) {
        $loaded = signage_read_json_file('security/auth_rate_limit.json', []);
        $GLOBALS['__signage_auth_rate_limit_state'] = is_array($loaded) ? $loaded : [];
    }
    return $GLOBALS['__signage_auth_rate_limit_state'];
}

function auth_rate_limit_update_state(array $state): void
{
    $GLOBALS['__signage_auth_rate_limit_state'] = $state;
    $error = null;
    if (!signage_write_json_file('security/auth_rate_limit.json', $state, $error)) {
        error_log('Failed to persist auth rate limit state: ' . ($error ?? 'write-failed'));
    }
}

function auth_rate_limit_normalize_entry(array $entry, int $now): array
{
    $failures = [];
    if (!empty($entry['failures']) && is_array($entry['failures'])) {
        foreach ($entry['failures'] as $timestamp) {
            $ts = (int) $timestamp;
            if ($ts > 0 && ($now - $ts) <= SIGNAGE_AUTH_RATE_LIMIT_WINDOW) {
                $failures[] = $ts;
            }
        }
    }
    $entry['failures'] = $failures;
    $lockedUntil = isset($entry['lockedUntil']) ? (int) $entry['lockedUntil'] : 0;
    if ($lockedUntil < $now) {
        $entry['lockedUntil'] = 0;
    } else {
        $entry['lockedUntil'] = $lockedUntil;
    }
    return $entry;
}

function auth_rate_limit_store_entry(string $key, array $entry): void
{
    $state = auth_rate_limit_state();
    if (empty($entry['failures']) && ((int) ($entry['lockedUntil'] ?? 0)) <= 0) {
        if (isset($state[$key])) {
            unset($state[$key]);
            auth_rate_limit_update_state($state);
        }
        return;
    }
    $state[$key] = $entry;
    auth_rate_limit_update_state($state);
}

function auth_rate_limit_guard(string $key): void
{
    if ($key === '' || !auth_is_enabled()) {
        return;
    }
    $now = time();
    $state = auth_rate_limit_state();
    $entry = $state[$key] ?? ['failures' => [], 'lockedUntil' => 0];
    $normalized = auth_rate_limit_normalize_entry($entry, $now);
    if ($normalized !== $entry) {
        auth_rate_limit_store_entry($key, $normalized);
    }
    $lockedUntil = isset($normalized['lockedUntil']) ? (int) $normalized['lockedUntil'] : 0;
    if ($lockedUntil > $now) {
        $retryAfter = $lockedUntil - $now;
        header('Retry-After: ' . $retryAfter);
        http_response_code(429);
        echo json_encode([
            'ok' => false,
            'error' => 'rate-limited',
            'retryAfter' => $retryAfter,
        ], SIGNAGE_JSON_RESPONSE_FLAGS);
        exit;
    }
}

function auth_rate_limit_register_failure(string $key): void
{
    if ($key === '' || !auth_is_enabled()) {
        return;
    }
    $now = time();
    $state = auth_rate_limit_state();
    $entry = $state[$key] ?? ['failures' => [], 'lockedUntil' => 0];
    $entry = auth_rate_limit_normalize_entry($entry, $now);
    $entry['failures'][] = $now;
    if (count($entry['failures']) >= SIGNAGE_AUTH_RATE_LIMIT_MAX_FAILURES) {
        $entry['lockedUntil'] = $now + SIGNAGE_AUTH_RATE_LIMIT_LOCKOUT;
        $entry['failures'] = [];
    }
    auth_rate_limit_store_entry($key, $entry);
}

function auth_rate_limit_clear(string $key): void
{
    if ($key === '' || !auth_is_enabled()) {
        return;
    }
    $state = auth_rate_limit_state();
    if (isset($state[$key])) {
        unset($state[$key]);
        auth_rate_limit_update_state($state);
    }
}

function auth_audit(string $event, array $context = []): void
{
    $user = auth_current_user();
    if ($user) {
        $context['user'] = $user['username'];
    }
    auth_append_audit($event, $context);
}
