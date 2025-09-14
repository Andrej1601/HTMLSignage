<?php
if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] !== 'on') {
    http_response_code(400);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['error' => 'https-required']);
    exit;
}

session_set_cookie_params([
    'secure' => true,
    'httponly' => true,
    'samesite' => 'Strict'
]);
session_start();
header('Content-Type: application/json; charset=UTF-8');

$defaultUser = 'admin';
$defaultHash = '$2y$12$/cyMQfwFihzIBnvH0ve/u.sbpUK.iZsRuUZXvDBxBw.dIxneEp.Qq';
$user = getenv('SIGNAGE_ADMIN_USER') ?: $defaultUser;
$hash = getenv('SIGNAGE_ADMIN_PASS_HASH') ?: $defaultHash;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token = $_POST['token'] ?? '';
    if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $token)) {
        http_response_code(400);
        echo json_encode(['error' => 'csrf']);
        exit;
    }
    $username = $_POST['username'] ?? '';
    $password = $_POST['password'] ?? '';
    if ($username === $user && password_verify($password, $hash)) {
        session_regenerate_id(true);
        $_SESSION['authenticated'] = true;
        unset($_SESSION['csrf_token']);
        echo json_encode(['ok' => 1]);
    } else {
        http_response_code(401);
        echo json_encode(['error' => 'invalid']);
    }
    exit;
}

if (!empty($_GET['token'])) {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    echo json_encode(['token' => $_SESSION['csrf_token']]);
    exit;
}

if (!empty($_SESSION['authenticated'])) {
    http_response_code(204);
} else {
    http_response_code(401);
}
