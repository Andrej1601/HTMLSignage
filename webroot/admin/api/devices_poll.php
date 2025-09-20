<?php
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__.'/devices_store.php';

$code = isset($_GET['code']) ? strtoupper(preg_replace('/[^A-Z0-9]/','',$_GET['code'])) : '';
if ($code===''){ echo json_encode(['ok'=>false,'error'=>'no-code']); exit; }

$db = devices_load();
$p = $db['pairings'][$code] ?? null;
if (!$p){ echo json_encode(['ok'=>true,'paired'=>false,'exists'=>false]); exit; }

if (!empty($p['deviceId'])){
  echo json_encode(['ok'=>true,'paired'=>true,'deviceId'=>$p['deviceId']]); exit;
}
echo json_encode(['ok'=>true,'paired'=>false,'exists'=>true]);
