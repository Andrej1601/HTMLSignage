<?php
require_once __DIR__ . '/devices_store.php';
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$body  = json_decode(file_get_contents('php://input'), true) ?: [];
$didIn = trim((string)($body['device'] ?? ''));
$purge = !empty($body['purge']);

$db = devices_load();
if (!$db) { echo json_encode(['ok'=>false,'error'=>'load-failed']); exit; }

$validNew = function($id){ return is_string($id) && preg_match('/^dev_[a-f0-9]{12}$/i', $id); };

// exakte Übereinstimmung (neues Format) …
$foundKey = isset($db['devices'][$didIn]) ? $didIn : null;

// … oder Legacy: numerische Schlüssel als String ("0","1",…)
if ($foundKey === null) {
  $legacyKey = (string)intval($didIn);
  if (isset($db['devices'][$legacyKey])) $foundKey = $legacyKey;
}

if ($foundKey === null) { echo json_encode(['ok'=>false,'error'=>'unknown-device']); exit; }

// Pairings entkoppeln
if (!empty($db['pairings'])) {
  foreach ($db['pairings'] as $code => &$row) {
    if (($row['deviceId'] ?? null) === $foundKey) unset($row['deviceId']);
  }
  unset($row);
}

// Purge: Gerätseintrag ganz weg, sonst nur Overrides löschen
if ($purge) { unset($db['devices'][$foundKey]); }
else {
  if (isset($db['devices'][$foundKey]['overrides'])) unset($db['devices'][$foundKey]['overrides']);
}

if (!devices_save($db)) { echo json_encode(['ok'=>false,'error'=>'save-failed']); exit; }
echo json_encode(['ok'=>true,'device'=>$foundKey,'removed'=>$purge?1:0]);
