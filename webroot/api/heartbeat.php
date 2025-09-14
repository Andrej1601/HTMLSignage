<?php
// /api/heartbeat.php
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/../admin/api/devices_store.php';

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
$id = $payload['device'] ?? ($_POST['device'] ?? ($_GET['device'] ?? ''));
$id = is_string($id) ? trim($id) : '';

if (!preg_match('/^dev_[a-f0-9]{12}$/i', $id)) {
  echo json_encode(['ok'=>false, 'error'=>'invalid-device']);
  exit;
}

$db = devices_load();
if (!isset($db['devices'][$id])) {
  echo json_encode(['ok'=>false, 'error'=>'unknown-device']);
  exit;
}
$db['devices'][$id]['lastSeen'] = time();
devices_save($db);

echo json_encode(['ok'=>true]);
