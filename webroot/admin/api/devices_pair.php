<?php
header('Content-Type: application/json; charset=UTF-8');
require __DIR__.'/devices_lib.php';
$raw = file_get_contents('php://input'); $j = json_decode($raw,true) ?: [];
$code = trim($j['code'] ?? '');
$name = trim($j['name'] ?? '');
if ($code==='' || $name===''){ echo json_encode(['ok'=>false,'error'=>'missing']); exit; }
$db = dev_load();
$d =& dev_find_by_code($db, $code);
if (!$d){ echo json_encode(['ok'=>false,'error'=>'not-found']); exit; }
if (!empty($d['paired'])){ echo json_encode(['ok'=>false,'error'=>'already']); exit; }
$id = dev_newid('dev_');
$d['id'] = $id;
$d['name'] = $name;
$d['paired'] = true;
$d['code'] = null;
$d['overrides'] = ['settings'=>new stdClass()]; // Platzhalter
dev_save($db);
echo json_encode(['ok'=>true,'deviceId'=>$id,'url'=>'/?device='.$id]);
