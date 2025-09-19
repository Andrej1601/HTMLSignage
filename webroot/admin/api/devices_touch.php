<?php
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__.'/devices_store.php';

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true);
if (!is_array($payload)) {
  $payload = [];
}

$id = $payload['device'] ?? ($_POST['device'] ?? ($_GET['device'] ?? ''));
$id = is_string($id) ? trim($id) : '';

if ($id === '') {
  echo json_encode(['ok'=>false,'error'=>'no-device']);
  exit;
}

if (!preg_match('/^dev_[a-f0-9]{12}$/i', $id)) {
  echo json_encode(['ok'=>false,'error'=>'invalid-device']);
  exit;
}

$db = devices_load();
if (!isset($db['devices'][$id])){
  echo json_encode(['ok'=>false,'error'=>'unknown-device']);
  exit;
}

$timestamp = time();
$db['devices'][$id]['lastSeen'] = $timestamp;
$db['devices'][$id]['lastSeenAt'] = $timestamp;

devices_save($db);
echo json_encode(['ok'=>true]);
