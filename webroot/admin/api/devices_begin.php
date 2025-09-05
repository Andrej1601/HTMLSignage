<?php
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__.'/devices_store.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['ok'=>false,'error'=>'method-not-allowed']);
  exit;
}
if (strtolower($_SERVER['HTTP_X_PAIR_REQUEST'] ?? '') !== '1') {
  http_response_code(403);
  echo json_encode(['ok'=>false,'error'=>'forbidden']);
  exit;
}

$db = dev_db_load();
dev_gc($db);

$code = dev_gen_code($db);
if (!$code) { http_response_code(500); echo json_encode(['ok'=>false,'error'=>'code-gen']); exit; }

$db['pairings'][$code] = ['code'=>$code, 'created'=>time(), 'deviceId'=>null];
dev_db_save($db);

echo json_encode(['ok'=>true,'code'=>$code]);
