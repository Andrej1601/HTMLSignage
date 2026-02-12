<?php
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__.'/devices_store.php';
session_start();

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

$db = devices_load();
dev_gc($db);

$ip = $_SERVER['REMOTE_ADDR'] ?? '';
$sess = session_id();
$now = time();

// Prüfen, ob für diese IP/Session bereits ein offenes Pairing existiert
foreach (($db['pairings'] ?? []) as $p) {
  $age = $now - (int)($p['created'] ?? $now);
  if ($age < 900 && empty($p['deviceId']) &&
      (($p['ip'] ?? null) === $ip || ($sess && ($p['session'] ?? null) === $sess))) {
    echo json_encode(['ok'=>true,'code'=>$p['code']]);
    exit;
  }
}

$code = dev_gen_code($db);
if (!$code) { http_response_code(500); echo json_encode(['ok'=>false,'error'=>'code-gen']); exit; }

$db['pairings'][$code] = [
  'code'=>$code,
  'created'=>$now,
  'deviceId'=>null,
  'ip'=>$ip,
  'session'=>$sess,
];
devices_save($db);

echo json_encode(['ok'=>true,'code'=>$code]);
