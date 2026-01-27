<?php
declare(strict_types=1);

namespace HTMLSignage\API\V1\Database;

use PDO;
use PDOException;

/**
 * Database connection singleton
 */
class Connection
{
    private static ?PDO $instance = null;
    private static string $dbPath = __DIR__ . '/../../../../data/signage.db';

    /**
     * Get database connection
     */
    public static function get(): PDO
    {
        if (self::$instance === null) {
            try {
                // Ensure data directory exists
                $dataDir = dirname(self::$dbPath);
                if (!is_dir($dataDir)) {
                    mkdir($dataDir, 0755, true);
                }

                self::$instance = new PDO(
                    'sqlite:' . self::$dbPath,
                    null,
                    null,
                    [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        PDO::ATTR_EMULATE_PREPARES => false,
                    ]
                );

                // Enable foreign keys
                self::$instance->exec('PRAGMA foreign_keys = ON');

                // Set journal mode for better concurrency
                self::$instance->exec('PRAGMA journal_mode = WAL');

            } catch (PDOException $e) {
                error_log("Database connection error: " . $e->getMessage());
                throw $e;
            }
        }

        return self::$instance;
    }

    /**
     * Begin transaction
     */
    public static function beginTransaction(): bool
    {
        return self::get()->beginTransaction();
    }

    /**
     * Commit transaction
     */
    public static function commit(): bool
    {
        return self::get()->commit();
    }

    /**
     * Rollback transaction
     */
    public static function rollback(): bool
    {
        return self::get()->rollBack();
    }

    /**
     * Execute query
     */
    public static function query(string $sql, array $params = []): \PDOStatement
    {
        $stmt = self::get()->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    /**
     * Fetch one row
     */
    public static function fetchOne(string $sql, array $params = []): ?array
    {
        $result = self::query($sql, $params)->fetch();
        return $result !== false ? $result : null;
    }

    /**
     * Fetch all rows
     */
    public static function fetchAll(string $sql, array $params = []): array
    {
        return self::query($sql, $params)->fetchAll();
    }

    /**
     * Get last insert ID
     */
    public static function lastInsertId(): string
    {
        return self::get()->lastInsertId();
    }
}
