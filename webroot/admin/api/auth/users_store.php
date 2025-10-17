<?php
// Nutzer- und Rollenverwaltung für das Admin-Interface
// Persistiert Benutzer in data/users.json und bietet Hilfsfunktionen für die APIs.

declare(strict_types=1);

require_once __DIR__ . '/../storage.php';

const SIGNAGE_AUTH_USERS_FILE = 'users.json';
const SIGNAGE_AUTH_AUDIT_FILE = 'audit.log';
const SIGNAGE_AUTH_BASIC_FILE = '.htpasswd';
const SIGNAGE_AUTH_ROLES = ['saunameister', 'editor', 'admin'];
const SIGNAGE_AUTH_DEFAULT_ROLE = 'saunameister';
const SIGNAGE_AUTH_ROLE_ALIASES = [
    'viewer' => 'saunameister',
    'sauna' => 'saunameister',
];
const SIGNAGE_AUTH_PROTECTED_USERS = ['admin'];

function auth_normalize_role_name(string $role): ?string
{
    $role = strtolower(trim($role));
    if ($role === '') {
        return null;
    }
    if (isset(SIGNAGE_AUTH_ROLE_ALIASES[$role])) {
        $role = SIGNAGE_AUTH_ROLE_ALIASES[$role];
    }
    if (!in_array($role, SIGNAGE_AUTH_ROLES, true)) {
        return null;
    }
    return $role;
}

function auth_is_protected_user(string $username): bool
{
    $username = strtolower(trim($username));
    return $username !== '' && in_array($username, SIGNAGE_AUTH_PROTECTED_USERS, true);
}

function auth_enforce_protected_roles(string $username, array $roles): array
{
    if (auth_is_protected_user($username) && !in_array('admin', $roles, true)) {
        $roles[] = 'admin';
    }
    return array_values(array_unique($roles));
}


function auth_users_public_payload(array $user): array
{
    return [
        'username' => $user['username'] ?? '',
        'displayName' => $user['displayName'] ?? null,
        'roles' => auth_user_roles($user),
    ];
}


function auth_users_path(): string
{
    $custom = getenv('USERS_PATH');
    if (is_string($custom) && $custom !== '') {
        return $custom;
    }
    if (!empty($_ENV['USERS_PATH'])) {
        return (string) $_ENV['USERS_PATH'];
    }
    return signage_data_path(SIGNAGE_AUTH_USERS_FILE);
}

function auth_audit_path(): string
{
    $custom = getenv('AUDIT_PATH');
    if (is_string($custom) && $custom !== '') {
        return $custom;
    }
    if (!empty($_ENV['AUDIT_PATH'])) {
        return (string) $_ENV['AUDIT_PATH'];
    }
    return signage_data_path(SIGNAGE_AUTH_AUDIT_FILE);
}

function auth_basic_path(): string
{
    $custom = getenv('BASIC_AUTH_FILE');
    if (is_string($custom) && $custom !== '') {
        return $custom;
    }
    if (!empty($_ENV['BASIC_AUTH_FILE'])) {
        return (string) $_ENV['BASIC_AUTH_FILE'];
    }
    return signage_data_path(SIGNAGE_AUTH_BASIC_FILE);
}

function auth_users_default(): array
{
    return ['users' => []];
}

function auth_users_normalize(array $state): array
{
    $normalized = auth_users_default();
    if (!empty($state['users']) && is_array($state['users'])) {
        foreach ($state['users'] as $entry) {
            if (!is_array($entry) || empty($entry['username'])) {
                continue;
            }
            $username = strtolower(trim((string) $entry['username']));
            if ($username === '') {
                continue;
            }
            $user = [
                'username' => $username,
                'displayName' => isset($entry['displayName']) && is_string($entry['displayName'])
                    ? trim($entry['displayName'])
                    : null,
                'password' => isset($entry['password']) && is_string($entry['password'])
                    ? $entry['password']
                    : null,
                'roles' => [],
            ];
            $roles = $entry['roles'] ?? $entry['role'] ?? [];
            if (is_string($roles)) {
                $roles = preg_split('/[,\s]+/', $roles) ?: [];
            }
            if (is_array($roles)) {
                foreach ($roles as $role) {
                    $roleName = auth_normalize_role_name((string) $role);
                    if ($roleName === null) {
                        continue;
                    }
                    if (!in_array($roleName, $user['roles'], true)) {
                        $user['roles'][] = $roleName;
                    }
                }
            }
            if (!$user['roles']) {
                $user['roles'][] = SIGNAGE_AUTH_DEFAULT_ROLE;
            }
            $user['roles'] = auth_enforce_protected_roles($username, $user['roles']);
            $normalized['users'][$username] = $user;
        }
    }
    return $normalized;
}

function auth_users_load(): array
{
    $path = auth_users_path();
    if (!is_file($path)) {
        return auth_users_default();
    }
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') {
        return auth_users_default();
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return auth_users_default();
    }
    return auth_users_normalize($decoded);
}

function auth_users_save(array $state): void
{
    $normalized = auth_users_normalize($state);
    $path = auth_users_path();
    @mkdir(dirname($path), 02775, true);
    $json = json_encode($normalized, SIGNAGE_JSON_FLAGS);
    if (@file_put_contents($path, $json, LOCK_EX) === false) {
        throw new RuntimeException('Unable to write users database');
    }
    @chmod($path, 0640);
    auth_basic_sync($normalized);
}

function auth_basic_sync(array $state): void
{
    $path = auth_basic_path();
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 02775, true) && !is_dir($dir)) {
        throw new RuntimeException('Unable to prepare basic auth directory');
    }
    $lines = [];
    foreach ($state['users'] as $user) {
        $username = isset($user['username']) ? trim((string) $user['username']) : '';
        $password = $user['password'] ?? '';
        if ($username === '' || !is_string($password) || $password === '') {
            continue;
        }
        $lines[] = $username . ':' . $password;
    }
    $content = $lines ? implode("\n", $lines) . "\n" : '';
    if (@file_put_contents($path, $content, LOCK_EX) === false) {
        throw new RuntimeException('Unable to write basic auth file');
    }
    @chmod($path, 0640);
}

function auth_users_find(string $username): ?array
{
    $state = auth_users_load();
    $key = strtolower(trim($username));
    return $state['users'][$key] ?? null;
}

function auth_users_set(array $user): void
{
    if (empty($user['username'])) {
        throw new InvalidArgumentException('username required');
    }
    $state = auth_users_load();
    $key = strtolower(trim((string) $user['username']));
    $current = $state['users'][$key] ?? [];
    $merged = array_merge($current, $user);
    $merged['username'] = $key;
    if (!empty($merged['roles']) && is_array($merged['roles'])) {
        $normalizedRoles = [];
        foreach ($merged['roles'] as $role) {
            $roleName = auth_normalize_role_name((string) $role);
            if ($roleName !== null) {
                $normalizedRoles[] = $roleName;
            }
        }
        $merged['roles'] = array_values(array_unique($normalizedRoles));
    }
    if (empty($merged['roles'])) {
        $merged['roles'] = [SIGNAGE_AUTH_DEFAULT_ROLE];
    }
    $merged['roles'] = auth_enforce_protected_roles($key, $merged['roles']);
    $state['users'][$key] = $merged;
    auth_users_save($state);
}

function auth_users_remove(string $username): bool
{
    $state = auth_users_load();
    $key = strtolower(trim($username));
    if (!isset($state['users'][$key])) {
        return false;
    }
    if (auth_is_protected_user($key)) {
        throw new RuntimeException('protected-user');
    }
    unset($state['users'][$key]);
    auth_users_save($state);
    return true;
}

function auth_users_count_admins(array $state, ?string $exclude = null): int
{
    $count = 0;
    foreach ($state['users'] as $username => $user) {
        if ($exclude !== null && $username === $exclude) {
            continue;
        }
        if (auth_user_has_role($user, 'admin')) {
            $count++;
        }
    }
    return $count;
}


function auth_user_roles(array $user): array
{
    $roles = [];
    if (!empty($user['roles']) && is_array($user['roles'])) {
        foreach ($user['roles'] as $role) {
            $roleName = strtolower(trim((string) $role));
            $roleName = auth_normalize_role_name($role);
            if ($roleName !== null) {
                $roles[] = $roleName;
            }
        }
    }
    if (!$roles) {
        $roles[] = SIGNAGE_AUTH_DEFAULT_ROLE;
    }
    return array_values(array_unique($roles));
}

function auth_user_has_role(array $user, string $role): bool
{
    $roleName = auth_normalize_role_name($role);
    if ($roleName === null) {
        return false;
    }
    $roles = auth_user_roles($user);
    $rank = auth_role_rank($roleName);
    foreach ($roles as $userRole) {
        if (auth_role_rank($userRole) >= $rank) {
            return true;
        }
    }
    return false;
}

function auth_role_rank(string $role): int
{
    static $map = ['saunameister' => 0, 'editor' => 1, 'admin' => 2];
    $role = auth_normalize_role_name($role) ?? $role;
    return $map[$role] ?? -1;
}

function auth_hash_password(string $password): string
{
    return password_hash($password, PASSWORD_DEFAULT);
}

function auth_verify_password(string $password, string $hash): bool
{
    if ($hash === '') {
        return false;
    }
    return password_verify($password, $hash);
}

function auth_append_audit(string $event, array $context = []): void
{
    $path = auth_audit_path();
    @mkdir(dirname($path), 02775, true);
    $row = [
        'ts' => time(),
        'event' => $event,
        'context' => $context,
    ];
    $line = json_encode($row, JSON_UNESCAPED_SLASHES) . "\n";
    @file_put_contents($path, $line, FILE_APPEND | LOCK_EX);
}
