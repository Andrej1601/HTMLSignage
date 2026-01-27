<?php
declare(strict_types=1);

namespace HTMLSignage\API\V1\Controllers;

use HTMLSignage\API\V1\Database\Connection;

/**
 * Base controller with common functionality
 */
abstract class BaseController
{
    protected function getDb(): \PDO
    {
        return Connection::get();
    }

    /**
     * Validate required fields
     */
    protected function validateRequired(array $data, array $required): array
    {
        $errors = [];

        foreach ($required as $field) {
            if (!isset($data[$field]) || $data[$field] === '') {
                $errors[$field] = "Field '$field' is required";
            }
        }

        return $errors;
    }

    /**
     * Sanitize string
     */
    protected function sanitize(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        return htmlspecialchars(trim($value), ENT_QUOTES, 'UTF-8');
    }

    /**
     * Get current timestamp
     */
    protected function now(): int
    {
        return time();
    }

    /**
     * Generate UUID v4
     */
    protected function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }

    /**
     * Log audit event
     */
    protected function audit(string $event, ?string $username = null, ?array $context = null): void
    {
        $stmt = $this->getDb()->prepare(
            'INSERT INTO audit_log (event, username, context) VALUES (?, ?, ?)'
        );
        $stmt->execute([
            $event,
            $username,
            $context ? json_encode($context) : null
        ]);
    }
}
