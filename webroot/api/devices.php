<?php
declare(strict_types=1);

require_once __DIR__ . '/../admin/api/devices_store.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$state = devices_load();
$state['now'] = time();

$json = json_encode($state, SIGNAGE_JSON_FLAGS);
if ($json === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'encode-failed'], SIGNAGE_JSON_FLAGS);
    return;
}

echo $json;
