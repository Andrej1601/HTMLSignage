#!/usr/bin/env php
<?php
// Database migration: Create remember_tokens table
declare(strict_types=1);

require_once __DIR__ . '/../storage.php';

echo "Creating remember_tokens table...\n";

try {
    $pdo = signage_db();

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS remember_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            token_hash TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        )
    ");

    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_remember_tokens_username ON remember_tokens(username)");
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_remember_tokens_expires ON remember_tokens(expires_at)");

    echo "✅ remember_tokens table created successfully!\n";
} catch (Throwable $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
