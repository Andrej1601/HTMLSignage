<?php
// /api/heartbeat.php
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/../admin/api/devices_store.php';

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload)) {
  $payload = [];
}
$id = $payload['device'] ?? ($_POST['device'] ?? ($_GET['device'] ?? ''));
$id = is_string($id) ? trim($id) : '';

if (!preg_match('/^dev_[a-f0-9]{12}$/i', $id)) {
  echo json_encode(['ok'=>false, 'error'=>'invalid-device']);
  exit;
}

$db = devices_load();
$dev = null;
if (isset($db['devices'][$id])) {
  $dev =& $db['devices'][$id];
} elseif (is_array($db['devices'] ?? null)) {
  foreach ($db['devices'] as &$row) {
    if (is_array($row) && ($row['id'] ?? null) === $id) {
      $dev =& $row;
      break;
    }
  }
  unset($row);
}

if (!isset($dev)) {
  echo json_encode(['ok'=>false, 'error'=>'unknown-device']);
  exit;
}

$timestamp = time();
$dev['lastSeen'] = $timestamp;
$dev['lastSeenAt'] = $timestamp;

try {
  devices_save($db);
} catch (RuntimeException $e) {
  http_response_code(500);
  error_log('Failed to persist device heartbeat: ' . $e->getMessage());
  echo json_encode(['ok'=>false, 'error'=>'storage-failed']);
  exit;
}

echo json_encode(['ok'=>true]);
