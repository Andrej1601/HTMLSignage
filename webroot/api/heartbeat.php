<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/../admin/api/devices_store.php';

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload)) {
    $payload = [];
}

$deviceId = $payload['device'] ?? ($_POST['device'] ?? ($_GET['device'] ?? ''));
$deviceId = devices_normalize_device_id($deviceId);

if ($deviceId === '') {
    signage_json_response(['ok' => false, 'error' => 'invalid-device']);
    return;
}

$telemetry = devices_extract_telemetry_payload($payload);
$timestamp = time();

$result = devices_touch_update($deviceId, $timestamp, $telemetry, 'device heartbeat');

if (!$result['ok']) {
    $status = (int) ($result['status'] ?? 500);
    $error = $result['error'] ?? 'touch-failed';
    signage_json_response(['ok' => false, 'error' => $error], $status);
    return;
}

signage_json_response(['ok' => true], (int) ($result['status'] ?? 200));
