<?php

declare(strict_types=1);

$usersPath = $argv[1] ?? '';
$basicPath = $argv[2] ?? '';
$auditPath = $argv[3] ?? '';

if ($usersPath === '') {
    fwrite(STDERR, "missing users path\n");
    exit(1);
}

if ($basicPath === '') {
    $basicPath = $usersPath . '.htpasswd';
}
if ($auditPath === '') {
    $auditPath = $usersPath . '.log';
}

putenv('USERS_PATH=' . $usersPath);
putenv('BASIC_AUTH_FILE=' . $basicPath);
putenv('AUDIT_PATH=' . $auditPath);

require __DIR__ . '/../../../webroot/admin/api/auth/guard.php';

auth_require_permission('devices');

echo json_encode(['ok' => true], SIGNAGE_JSON_RESPONSE_FLAGS);
