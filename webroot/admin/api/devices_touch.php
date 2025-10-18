<?php
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/devices_store.php';

auth_require_role('editor');

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
$payload = is_array($payload) ? $payload : [];

$rawDevice = $payload['device'] ?? ($_POST['device'] ?? ($_GET['device'] ?? ''));
$rawDevice = is_string($rawDevice) ? trim($rawDevice) : '';
$deviceId = devices_normalize_device_id($rawDevice);

if ($rawDevice === '') {
  echo json_encode(['ok' => false, 'error' => 'no-device']);
  exit;
}

if ($deviceId === '') {
  echo json_encode(['ok' => false, 'error' => 'invalid-device']);
  exit;
}

$telemetry = devices_extract_telemetry_payload($payload);
$ok = false;
try {
  $ok = devices_touch_entry_persistent($deviceId, null, $telemetry);
} catch (RuntimeException $e) {
  http_response_code(500);
  error_log('Failed to persist device touch: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => 'storage-failed']);
  exit;
}

if (!$ok) {
  echo json_encode(['ok' => false, 'error' => 'unknown-device']);
  exit;
}

echo json_encode(['ok' => true]);
