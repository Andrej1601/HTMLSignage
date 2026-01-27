<?php
// Login Handler - Session-based authentication
declare(strict_types=1);

require_once __DIR__ . '/session_manager.php';

header('Content-Type: application/json; charset=UTF-8');

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'method_not_allowed']);
    exit;
}

// Parse JSON body
$body = file_get_contents('php://input');
$data = json_decode($body, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'invalid_json']);
    exit;
}

$username = trim($data['username'] ?? '');
$password = $data['password'] ?? '';
$remember = !empty($data['remember']);

if ($username === '' || $password === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'missing_credentials',
        'message' => 'Benutzername und Passwort erforderlich',
    ]);
    exit;
}

// Attempt authentication
$success = session_authenticate($username, $password, $remember);

if ($success) {
    $user = session_get_user();

    echo json_encode([
        'success' => true,
        'message' => 'Login erfolgreich',
        'user' => [
            'username' => $user['username'] ?? $username,
            'displayName' => $user['displayName'] ?? null,
            'roles' => auth_user_roles($user),
        ],
        'csrf_token' => session_csrf_token(),
    ]);
} else {
    http_response_code(401);
    echo json_encode([
        'success' => false,
        'error' => 'invalid_credentials',
        'message' => 'Ungültige Anmeldedaten',
    ]);
}
