<?php
header('Content-Type: application/json; charset=UTF-8');
$raw = file_get_contents('php://input');
if ($raw===''){ http_response_code(400); echo json_encode(['ok'=>false,'error'=>'empty']); exit; }
$data = json_decode($raw,true);
if (!is_array($data) || !isset($data['schedule']) || !isset($data['settings'])) {
  http_response_code(400); echo json_encode(['ok'=>false,'error'=>'bad-json']); exit;
}
$ok1 = file_put_contents('/var/www/signage/data/schedule.json', json_encode($data['schedule'], JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT));
$ok2 = file_put_contents('/var/www/signage/data/settings.json', json_encode($data['settings'], JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT));
if (!$ok1 || !$ok2) { http_response_code(500); echo json_encode(['ok'=>false,'error'=>'write-failed']); exit; }
echo json_encode(['ok'=>true]);
