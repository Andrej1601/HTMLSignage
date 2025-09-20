<?php
require_once __DIR__ . '/devices_store.php';
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$body = json_decode(file_get_contents('php://input'), true) ?: [];
$devIn = trim((string)($body['device'] ?? ''));
$name  = trim((string)($body['name'] ?? ''));

if ($devIn === '') {
  echo json_encode(['ok'=>false, 'error'=>'missing-device']);
  exit;
}

$db = devices_load();
if (!$db) {
  echo json_encode(['ok'=>false, 'error'=>'load-failed']);
  exit;
}

// exakte Übereinstimmung (neues Format) …
$foundKey = isset($db['devices'][$devIn]) ? $devIn : null;
// … oder Legacy: numerische Schlüssel als String ("0","1",…)
if ($foundKey === null) {
  $legacyKey = (string)intval($devIn);
  if (isset($db['devices'][$legacyKey])) {
    $foundKey = $legacyKey;
  }
}

if ($foundKey === null) {
  echo json_encode(['ok'=>false, 'error'=>'unknown-device']);
  exit;
}

$db['devices'][$foundKey]['name'] = $name;

try {
  devices_save($db);
} catch (Exception $e) {
  echo json_encode(['ok'=>false, 'error'=>'save-failed']);
  exit;
}

echo json_encode(['ok'=>true, 'device'=>$foundKey, 'name'=>$name]);
