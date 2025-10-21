<?php
declare(strict_types=1);

require_once __DIR__ . '/../admin/api/storage.php';

$settings = signage_read_json('settings.json', signage_default_settings());
$json = json_encode($settings, SIGNAGE_JSON_RESPONSE_FLAGS);
if ($json === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'encode-failed'], SIGNAGE_JSON_RESPONSE_FLAGS);
    return;
}

$meta = signage_data_meta('settings.json', SIGNAGE_SETTINGS_STORAGE_KEY);
$mtime = (int) ($meta['mtime'] ?? 0);
$hash = $meta['hash'] ?? null;
if ($hash === null) {
    $hash = sha1($json);
}
$etag = sprintf('"%s"', $hash);

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: max-age=30, public, must-revalidate');
header('ETag: ' . $etag);
header('Last-Modified: ' . signage_format_http_date($mtime));

if (signage_should_return_not_modified($etag, $mtime)) {
    http_response_code(304);
    header('Content-Length: 0');
    return;
}

echo $json;
