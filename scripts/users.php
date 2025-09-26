#!/usr/bin/env php
<?php
declare(strict_types=1);

require_once __DIR__ . '/../webroot/admin/api/auth/users_store.php';

function usage(): void
{
    echo "Usage:\n";
    echo "  php scripts/users.php list\n";
    echo "  php scripts/users.php add <username> [roles]\n";
    echo "  php scripts/users.php delete <username>\n";
    echo "\nRoles: viewer, editor, admin (default: viewer)\n";
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
        $rolesArg = $argv[3] ?? 'viewer';
        $roles = array_values(array_filter(array_map('trim', preg_split('/[,\s]+/', $rolesArg) ?: [])));
        if (!$roles) {
            $roles = ['viewer'];
        }
        $password = getenv('SIGNAGE_USER_PASSWORD') ?: prompt_hidden('Password: ');
        if ($password === '') {
            fwrite(STDERR, "Password required\n");
            exit(1);
        }
        $confirm = getenv('SIGNAGE_USER_PASSWORD_CONFIRM') ?: prompt_hidden('Repeat password: ');
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
        exit(0);

    case 'delete':
        $username = $argv[2] ?? '';
        if ($username === '') {
            usage();
        }
        if (auth_users_remove($username)) {
            echo "User '{$username}' removed.\n";
            exit(0);
        }
        fwrite(STDERR, "User not found.\n");
        exit(1);

    default:
        usage();
}
