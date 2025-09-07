<?php
// Hängt am ADMIN-VHost (BasicAuth schützt), nicht im öffentlichen /pair/*
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__.'/devices_store.php';

$raw = file_get_contents('php://input');
$in  = json_decode($raw, true);
$code = strtoupper(trim($in['code'] ?? ''));
$name = trim($in['name'] ?? '');

if ($code===''){ echo json_encode(['ok'=>false,'error'=>'no-code']); exit; }

$db = dev_db_load();
$p  = $db['pairings'][$code] ?? null;
if (!$p){ echo json_encode(['ok'=>false,'error'=>'unknown-code']); exit; }
if (!empty($p['deviceId'])){ echo json_encode(['ok'=>true,'deviceId'=>$p['deviceId'], 'already'=>true]); exit; }

$id = dev_gen_id($db);
$db['devices'][$id] = [
  'id'=>$id, 'name'=>$name, 'created'=>time(), 'lastSeen'=>0
];
$db['pairings'][$code]['deviceId'] = $id;
dev_db_save($db);

echo json_encode(['ok'=>true,'deviceId'=>$id]);
