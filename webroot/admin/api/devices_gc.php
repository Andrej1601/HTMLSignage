<?php
// /admin/api/devices_gc.php – aufräumen & reparieren (vollständig)
require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/devices_store.php';
auth_require_role('editor');
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$db = devices_load();
if (!$db) { echo json_encode(['ok'=>false,'error'=>'load-failed']); exit; }

$deletedDevices = 0;
$deletedPairings = 0;

// 1) Ungültige Geräte-IDs entfernen
foreach (($db['devices'] ?? []) as $id => $_) {
 if (!preg_match('/^dev_[a-f0-9]{12}$/i', (string)$id)) {
 unset($db['devices'][$id]);
 $deletedDevices++;
 }
}

// 2) Abgelaufene, nicht gekoppelte Pairings entfernen (>15min)
$now = time();
foreach (($db['pairings'] ?? []) as $code => $row) {
 $age = $now - (int)($row['created'] ?? $now);
 if (empty($row['deviceId']) && $age > 900) {
 unset($db['pairings'][$code]);
 $deletedPairings++;
 }
}

// 3) Beziehungen reparieren: deviceId, die auf nicht-existentes Device zeigt, lösen
foreach (($db['pairings'] ?? []) as $code => $row) {
 $did = $row['deviceId'] ?? null;
 if ($did && empty($db['devices'][$did])) {
 $db['pairings'][$code]['deviceId'] = null;
 }
}

try {
  devices_save($db);
} catch (RuntimeException $e) {
  http_response_code(500);
  error_log('Failed to persist device GC results: ' . $e->getMessage());
  echo json_encode(['ok'=>false,'error'=>'save-failed']);
  exit;
}
auth_audit('device.gc', [
  'deletedDevices' => $deletedDevices,
  'deletedPairings' => $deletedPairings
]);
echo json_encode(['ok'=>true,'deletedDevices'=>$deletedDevices,'deletedPairings'=>$deletedPairings]);
