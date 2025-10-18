#!/usr/bin/env php
<?php
declare(strict_types=1);

require_once __DIR__ . '/../webroot/admin/api/storage.php';

$documents = array_slice($argv, 1);
if (!$documents) {
    $documents = ['schedule.json', 'settings.json'];
}

$docs = [];
foreach ($documents as $doc) {
    $name = trim((string) $doc);
    if ($name === '') {
        continue;
    }
    if (!str_ends_with($name, '.json')) {
        $name .= '.json';
    }
    $docs[] = $name;
}

if (!$docs) {
    fwrite(STDERR, "No documents specified.\n");
    exit(1);
}

$pdo = signage_db();
if (!($pdo instanceof PDO)) {
    fwrite(STDERR, "Database connection unavailable.\n");
    exit(1);
}

$exitCode = 0;
foreach ($docs as $doc) {
    try {
        $raw = signage_db_fetch_document($pdo, signage_document_key($doc));
    } catch (Throwable $e) {
        fwrite(STDERR, sprintf("Failed to read '%s': %s\n", $doc, $e->getMessage()));
        $exitCode = 1;
        continue;
    }

    if ($raw === null) {
        fwrite(STDERR, sprintf("Document '%s' not found in database.\n", $doc));
        $exitCode = 1;
        continue;
    }

    $error = null;
    if (!signage_write_json_to_file($doc, $raw, $error)) {
        fwrite(STDERR, sprintf("Failed to write fallback for '%s': %s\n", $doc, $error ?? 'unknown error'));
        $exitCode = 1;
        continue;
    }

    fwrite(STDOUT, sprintf("Wrote fallback file for '%s'.\n", $doc));
}

exit($exitCode);
