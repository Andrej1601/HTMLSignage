<?php
declare(strict_types=1);

require_once __DIR__ . '/devices_store.php';

header('Content-Type: application/json; charset=UTF-8');

/**
 * Send a JSON response and terminate the request.
 */
function devices_poll_respond(array $payload, int $status = 200): void
{
    if (!headers_sent()) {
        http_response_code($status);
    }

    $json = json_encode($payload, SIGNAGE_JSON_RESPONSE_FLAGS);
    if ($json === false) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'json-encode-failed'], SIGNAGE_JSON_RESPONSE_FLAGS);
        exit;
    }

    echo $json;
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    header('Allow: GET');
    devices_poll_respond(['ok' => false, 'error' => 'method-not-allowed'], 405);
}

$code = devices_normalize_code($_GET['code'] ?? '');
if ($code === '') {
    devices_poll_respond(['ok' => false, 'error' => 'no-code']);
}

$state = devices_load();
$pairings = is_array($state['pairings'] ?? null) ? $state['pairings'] : [];
$pairing = $pairings[$code] ?? null;
if (!is_array($pairing)) {
    devices_poll_respond(['ok' => true, 'paired' => false, 'exists' => false]);
}

$deviceId = $pairing['deviceId'] ?? null;
if (is_string($deviceId) && $deviceId !== '') {
    devices_poll_respond(['ok' => true, 'paired' => true, 'deviceId' => $deviceId]);
}

devices_poll_respond(['ok' => true, 'paired' => false, 'exists' => true]);
