#!/usr/bin/env php
<?php
declare(strict_types=1);

require_once __DIR__ . '/../webroot/admin/api/storage.php';

function migrate_usage(): void
{
    fwrite(STDERR, "Usage: php scripts/migrate.php [--quiet]\n");
    exit(1);
}

$quiet = false;

foreach (array_slice($_SERVER['argv'] ?? [], 1) as $arg) {
    if ($arg === '--quiet') {
        $quiet = true;
        continue;
    }

    if ($arg === '--help' || $arg === '-h') {
        migrate_usage();
    }

    fwrite(STDERR, "Unknown argument: {$arg}\n");
    migrate_usage();
}

if (!signage_db_available()) {
    fwrite(STDERR, "SQLite backend not available. Install php-sqlite3 and configure SIGNAGE_DB_PATH.\n");
    exit(1);
}

try {
    signage_db_bootstrap();
} catch (Throwable $exception) {
    fwrite(STDERR, 'Failed to initialize SQLite schema: ' . $exception->getMessage() . "\n");
    exit(1);
}

if (!$quiet) {
    $path = signage_db_path();
    fwrite(STDOUT, "SQLite schema ready at {$path}\n");
}
