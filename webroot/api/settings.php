<?php
declare(strict_types=1);

require_once __DIR__ . '/../admin/api/storage.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

$settings = signage_read_json('settings.json', signage_default_settings());
$json = json_encode($settings, SIGNAGE_JSON_RESPONSE_FLAGS);
if ($json === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'encode-failed'], SIGNAGE_JSON_RESPONSE_FLAGS);
    return;
}

echo $json;
