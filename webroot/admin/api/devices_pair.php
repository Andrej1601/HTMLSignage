<?php
// /admin/api/devices_pair.php – Legacy-Pairing via Code und Name
// Wird weiterhin unterstützt, verwendet aber nun die gemeinsamen Helfer.

header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__ . '/auth/guard.php';
require_once __DIR__.'/devices_store.php';

auth_require_role('editor');

$raw = file_get_contents('php://input');
$j   = json_decode($raw, true) ?: [];
$code = strtoupper(trim($j['code'] ?? ''));
$name = trim($j['name'] ?? '');
if ($code === '' || $name === '') {
  echo json_encode(['ok'=>false,'error'=>'missing']);
  exit;
}

$db = devices_load();
$p  = $db['pairings'][$code] ?? null;
if (!$p) { echo json_encode(['ok'=>false,'error'=>'not-found']); exit; }
if (!empty($p['deviceId'])) { echo json_encode(['ok'=>false,'error'=>'already']); exit; }

$id = dev_gen_id($db);
if (!$id) { echo json_encode(['ok'=>false,'error'=>'id-gen']); exit; }

$db['devices'][$id] = [
  'id'        => $id,
  'name'      => $name,
  'created'   => time(),
  'lastSeen'  => 0,
  'overrides' => ['settings'=>(object)[]]
];
$db['pairings'][$code]['deviceId'] = $id;

devices_save($db);
echo json_encode(['ok'=>true,'deviceId'=>$id,'url'=>'/?device='.$id]);

