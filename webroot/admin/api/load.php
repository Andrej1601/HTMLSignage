<?php
require_once __DIR__ . '/storage.php';

header('Content-Type: application/json; charset=UTF-8');
$fn = signage_data_path('schedule.json');
if(!is_file($fn)){ http_response_code(404); echo json_encode(['error'=>'no-schedule']); exit; }
$raw = file_get_contents($fn);
if ($raw === false) { http_response_code(500); echo json_encode(['error'=>'read-failed']); exit; }
echo $raw;
