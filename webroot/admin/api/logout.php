<?php
/**
 * Logout Endpoint - Redirect to new session-based handler
 * This file is kept for backwards compatibility
 */
declare(strict_types=1);

// Redirect to new session-based logout handler
header('Location: /admin/api/auth/logout_handler.php');
exit;
