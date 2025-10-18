<?php
require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/storage.php';

$user = auth_require_permission('slides');
$canWriteSettings = auth_user_has_permission($user, 'system');

header('Content-Type: application/json; charset=UTF-8');
$raw = file_get_contents('php://input');
if ($raw===''){ http_response_code(400); echo json_encode(['ok'=>false,'error'=>'empty']); exit; }
$data = json_decode($raw,true);
if (!is_array($data) || !isset($data['schedule']) || !isset($data['settings'])) {
  http_response_code(400); echo json_encode(['ok'=>false,'error'=>'bad-json']); exit;
}
$err1 = $err2 = null;
$ok1 = signage_write_json('schedule.json', $data['schedule'], $err1);
$ok2 = true;
if ($canWriteSettings) {
  $ok2 = signage_write_json('settings.json', $data['settings'], $err2);
}
if (!$ok1 || !$ok2) {
  if ($err1) error_log('[signage] save schedule failed: ' . $err1);
  if ($err2) error_log('[signage] save settings failed: ' . $err2);
  http_response_code(500); echo json_encode(['ok'=>false,'error'=>'write-failed']); exit;
}
echo json_encode([
  'ok' => true,
  'settingsWritten' => $canWriteSettings,
]);
