<?php
require_once __DIR__ . '/devices_lib.php';
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$raw = file_get_contents('php://input');
$in  = json_decode($raw, true);
if (!$in || !isset($in['device']) || !is_array($in['settings'])) {
  echo json_encode(['ok'=>false, 'error'=>'missing']); exit;
}
$devId = $in['device'];
$set   = $in['settings'];
$sch   = isset($in['schedule']) && is_array($in['schedule']) ? $in['schedule'] : null;

$dev = devices_load();
if (!isset($dev['devices'][$devId])) {
  echo json_encode(['ok'=>false, 'error'=>'unknown-device']); exit;
}

// Version hochzählen (Signal für Clients)
$set['version'] = intval($set['version'] ?? 0) + 1;
if ($sch !== null) {
  $sch['version'] = intval($sch['version'] ?? 0) + 1;
}

$dev['devices'][$devId]['overrides'] = $dev['devices'][$devId]['overrides'] ?? [];
$dev['devices'][$devId]['overrides']['settings'] = $set;
if ($sch !== null) {
  $dev['devices'][$devId]['overrides']['schedule'] = $sch;
}

$dev['devices'][$devId]['useOverrides'] = true;

if (!devices_save($dev)) {
  echo json_encode(['ok'=>false, 'error'=>'write-failed']); exit;
}
echo json_encode([
  'ok'=>true,
  'version'=>$set['version'],
  'scheduleVersion'=> $sch['version'] ?? null
]);
