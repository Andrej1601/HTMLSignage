<?php
// Logout Handler - Session-based authentication
declare(strict_types=1);

require_once __DIR__ . '/session_manager.php';

// Destroy session
session_destroy_user();

// Redirect to login or return JSON based on request
if (str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json')) {
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'success' => true,
        'message' => 'Erfolgreich abgemeldet',
    ]);
} else {
    header('Location: /admin/login.php?logged_out=1');
}
exit;
