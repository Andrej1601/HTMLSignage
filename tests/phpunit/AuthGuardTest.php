<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../webroot/admin/api/storage.php';

final class AuthGuardTest extends TestCase
{
    private function createUsersFile(array $users): string
    {
        $path = tempnam(sys_get_temp_dir(), 'users_');
        if ($path === false) {
            $this->fail('Unable to create temporary users file');
        }
        $payload = ['users' => $users];
        file_put_contents($path, json_encode($payload, SIGNAGE_JSON_STORAGE_FLAGS));
        return $path;
    }

    /**
     * @runInSeparateProcess
     */
    public function testUnauthenticatedRequestsAreRejectedWhenUsersExist(): void
    {
        $hash = password_hash('secret', PASSWORD_DEFAULT);
        $usersFile = $this->createUsersFile([
            ['username' => 'admin', 'password' => $hash, 'roles' => ['admin']]
        ]);
        $basicFile = tempnam(sys_get_temp_dir(), 'basic_');
        $auditFile = tempnam(sys_get_temp_dir(), 'audit_');
        $script = __DIR__ . '/../php/scripts/guard_require_permission.php';

        $command = sprintf(
            '%s %s %s %s %s',
            escapeshellcmd(PHP_BINARY),
            escapeshellarg($script),
            escapeshellarg($usersFile),
            escapeshellarg($basicFile ?: $usersFile . '.htpasswd'),
            escapeshellarg($auditFile ?: $usersFile . '.log')
        );
        exec($command, $output, $exitCode);

        $this->assertSame(0, $exitCode);
        $this->assertNotEmpty($output);
        $this->assertSame('{"ok":false,"error":"auth-required"}', trim(end($output)));
    }

    /**
     * @runInSeparateProcess
     */
    public function testValidCredentialsGrantAccess(): void
    {
        $hash = password_hash('secret', PASSWORD_DEFAULT);
        $usersFile = $this->createUsersFile([
            ['username' => 'editor', 'password' => $hash, 'roles' => ['editor']]
        ]);
        $basicFile = tempnam(sys_get_temp_dir(), 'basic_');
        $auditFile = tempnam(sys_get_temp_dir(), 'audit_');

        putenv('USERS_PATH=' . $usersFile);
        putenv('BASIC_AUTH_FILE=' . ($basicFile ?: $usersFile . '.htpasswd'));
        putenv('AUDIT_PATH=' . ($auditFile ?: $usersFile . '.log'));

        require __DIR__ . '/../../webroot/admin/api/auth/guard.php';

        $_SERVER['PHP_AUTH_USER'] = 'editor';
        $_SERVER['PHP_AUTH_PW'] = 'secret';

        $user = auth_require_permission('devices');

        $this->assertSame('editor', $user['username']);
        $this->assertTrue(in_array('editor', $user['roles'], true));
    }
}
