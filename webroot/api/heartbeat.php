<?php
// /api/heartbeat.php
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/../admin/api/devices_store.php';

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
$payload = is_array($payload) ? $payload : [];
$deviceId = $payload['device'] ?? ($_POST['device'] ?? ($_GET['device'] ?? ''));
$deviceId = devices_normalize_device_id($deviceId);

if ($deviceId === '') {
  echo json_encode(['ok' => false, 'error' => 'invalid-device']);
  exit;
}

$db = devices_load();
$telemetry = devices_extract_telemetry_payload($payload);
if (!devices_touch_entry($db, $deviceId, null, $telemetry)) {
  echo json_encode(['ok' => false, 'error' => 'unknown-device']);
  exit;
}

try {
  devices_save($db);
} catch (RuntimeException $e) {
  http_response_code(500);
  error_log('Failed to persist device heartbeat: ' . $e->getMessage());
  echo json_encode(['ok' => false, 'error' => 'storage-failed']);
  exit;
}

echo json_encode(['ok' => true]);
