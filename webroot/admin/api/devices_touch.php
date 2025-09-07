<?php
header('Content-Type: application/json; charset=UTF-8');
require_once __DIR__.'/devices_store.php';

$id = isset($_GET['device']) ? $_GET['device'] : '';
if ($id===''){ echo json_encode(['ok'=>false,'error'=>'no-device']); exit; }

$db = dev_db_load();
if (!isset($db['devices'][$id])){ echo json_encode(['ok'=>false,'error'=>'unknown-device']); exit; }
$db['devices'][$id]['lastSeen'] = time();
dev_db_save($db);
echo json_encode(['ok'=>true]);
