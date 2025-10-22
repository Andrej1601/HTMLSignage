<?php
declare(strict_types=1);

require_once __DIR__ . '/../admin/api/storage.php';

$state = signage_schedule_state();
$schedule = $state['data'];
$json = $state['json'];
if (!is_string($json)) {
    $json = json_encode($schedule, SIGNAGE_JSON_RESPONSE_FLAGS);
}
if ($json === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'encode-failed'], SIGNAGE_JSON_RESPONSE_FLAGS);
    return;
}

$meta = $state['meta'];
$mtime = (int) ($meta['mtime'] ?? 0);
$hash = $meta['hash'] ?? sha1($json);
$etag = sprintf('"%s"', $hash);

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: public, max-age=' . SIGNAGE_CACHE_SCHEDULE_TTL . ', stale-while-revalidate=' . (SIGNAGE_CACHE_SCHEDULE_TTL * 2));
header('Expires: ' . signage_format_http_date(time() + SIGNAGE_CACHE_SCHEDULE_TTL));
header('ETag: ' . $etag);
header('Last-Modified: ' . signage_format_http_date($mtime));

if (signage_should_return_not_modified($etag, $mtime)) {
    http_response_code(304);
    header('Content-Length: 0');
    return;
}

echo $json;
