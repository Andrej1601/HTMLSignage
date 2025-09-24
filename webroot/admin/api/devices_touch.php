<?php
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/devices_store.php';

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

$db = devices_load();
if (!devices_touch_entry($db, $deviceId)) {
  echo json_encode(['ok' => false, 'error' => 'unknown-device']);
  exit;
}

try {
  devices_save($db);
} catch (RuntimeException $e) {
  http_response_code(500);
  error_log('Failed to persist device touch: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => 'storage-failed']);
  exit;
}
echo json_encode(['ok' => true]);
