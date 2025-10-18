#!/usr/bin/env php
<?php
declare(strict_types=1);

require_once __DIR__ . '/../webroot/admin/api/auth/users_store.php';

if (!signage_db_available()) {
    fwrite(STDERR, "SQLite backend not available. Install php8.3-sqlite3 and ensure SIGNAGE_DB_PATH is configured.\n");
    exit(1);
}

try {
    signage_db_bootstrap();
} catch (Throwable $exception) {
    fwrite(STDERR, 'Unable to initialize SQLite backend: ' . $exception->getMessage() . "\n");
    exit(1);
}

function usage(): void
{
    echo "Usage:\n";
    echo "  php scripts/users.php list\n";
    echo "  php scripts/users.php add <username> [roles]\n";
    echo "  php scripts/users.php delete <username>\n";
    echo "\nRoles: saunameister, editor, admin (default: saunameister)\n";
    exit(1);
}

function prompt_hidden(string $prompt): string
{
    if (!function_exists('posix_isatty') || !posix_isatty(STDIN)) {
        echo $prompt;
        return trim((string) fgets(STDIN));
    }
    echo $prompt;
    $stty = shell_exec('stty -g');
    system('stty -echo');
    $value = trim((string) fgets(STDIN));
    if ($stty) {
        system('stty ' . $stty);
    } else {
        system('stty echo');
    }
    echo PHP_EOL;
    return $value;
}

$argv = $_SERVER['argv'] ?? [];
$command = $argv[1] ?? 'help';

switch ($command) {
    case 'list':
        $state = auth_users_load();
        if (empty($state['users'])) {
            echo "No users configured.\n";
            exit(0);
        }
        foreach ($state['users'] as $user) {
            $roles = implode(',', auth_user_roles($user));
            $display = $user['displayName'] ?? '';
            echo $user['username'];
            if ($display !== '') {
                echo " ({$display})";
            }
            echo " – roles: {$roles}\n";
        }
        exit(0);

    case 'add':
    case 'update':
        $username = $argv[2] ?? '';
        if ($username === '') {
            usage();
        }
        $rolesArg = $argv[3] ?? SIGNAGE_AUTH_DEFAULT_ROLE;
        $roles = array_values(array_filter(array_map('trim', preg_split('/[,\s]+/', $rolesArg) ?: [])));
        if (!$roles) {
            $roles = [SIGNAGE_AUTH_DEFAULT_ROLE];
        }
        $roles = array_values(array_unique(array_filter(array_map(static function (string $role): ?string {
            return auth_normalize_role_name($role);
        }, $roles))));
        if (!$roles) {
            $roles = [SIGNAGE_AUTH_DEFAULT_ROLE];
        }
        $passwordEnv = getenv('SIGNAGE_USER_PASSWORD');
        $passwordFromEnv = $passwordEnv !== false && $passwordEnv !== '';
        $password = $passwordFromEnv ? (string) $passwordEnv : prompt_hidden('Password: ');
        if ($password === '') {
            fwrite(STDERR, "Password required\n");
            exit(1);
        }
        $confirmEnv = getenv('SIGNAGE_USER_PASSWORD_CONFIRM');
        if ($confirmEnv === false) {
            $confirm = $passwordFromEnv ? $password : prompt_hidden('Repeat password: ');
        } else {
            $confirm = (string) $confirmEnv;
        }
        if ($password !== $confirm) {
            fwrite(STDERR, "Passwords do not match\n");
            exit(1);
        }
        $displayName = getenv('SIGNAGE_USER_DISPLAY') ?: '';
        $user = [
            'username' => $username,
            'roles' => $roles,
            'password' => auth_hash_password($password),
        ];
        if ($displayName !== '') {
            $user['displayName'] = $displayName;
        }
        auth_users_set($user);
        echo "User '{$username}' saved.\n";
        if ($passwordFromEnv) {
            putenv('SIGNAGE_USER_PASSWORD=');
            putenv('SIGNAGE_USER_PASSWORD_CONFIRM=');
            unset($_ENV['SIGNAGE_USER_PASSWORD'], $_ENV['SIGNAGE_USER_PASSWORD_CONFIRM']);
            unset($_SERVER['SIGNAGE_USER_PASSWORD'], $_SERVER['SIGNAGE_USER_PASSWORD_CONFIRM']);
        }
        exit(0);

    case 'delete':
        $username = $argv[2] ?? '';
        if ($username === '') {
            usage();
        }
        try {
            if (auth_is_protected_user($username)) {
                throw new RuntimeException('protected-user');
            }
            if (auth_users_remove($username)) {
                echo "User '{$username}' removed.\n";
                exit(0);
            }
        } catch (RuntimeException $exception) {
            if ($exception->getMessage() === 'protected-user') {
                fwrite(STDERR, "Cannot remove protected admin account.\n");
                exit(1);
            }
        }
        fwrite(STDERR, "User not found.\n");
        exit(1);

    default:
        usage();
}
