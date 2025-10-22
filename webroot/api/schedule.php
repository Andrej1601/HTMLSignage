<?php
declare(strict_types=1);

require_once __DIR__ . '/../admin/api/storage.php';

$state = signage_schedule_state();
$schedule = $state['data'];
$json = $state['json'];
$meta = $state['meta'];
$mtime = (int) ($meta['mtime'] ?? 0);

$version = $schedule['version'] ?? null;
$scheduleChanged = false;
if (!is_int($version)) {
    if (is_numeric($version)) {
        $version = (int) $version;
    } else {
        $version = null;
    }
}
if (!is_int($version) || $version <= 0) {
    $metaVersion = $meta['version'] ?? null;
    if (is_numeric($metaVersion)) {
        $version = (int) $metaVersion;
    }
}
if (!is_int($version) || $version <= 0) {
    $version = $mtime > 0 ? $mtime : 1;
}
if (!isset($schedule['version']) || $schedule['version'] !== $version) {
    $schedule['version'] = $version;
    $json = json_encode($schedule, SIGNAGE_JSON_RESPONSE_FLAGS);
    $scheduleChanged = true;
} elseif (!is_string($json)) {
    $json = json_encode($schedule, SIGNAGE_JSON_RESPONSE_FLAGS);
    $scheduleChanged = true;
}
if ($json === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'encode-failed'], SIGNAGE_JSON_RESPONSE_FLAGS);
    return;
}

$hash = $meta['hash'] ?? null;
if (!is_string($hash) || $hash === '' || $scheduleChanged) {
    $hash = sha1($json);
}
$etag = sprintf('"%s"', $hash);

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: public, max-age=' . SIGNAGE_CACHE_SCHEDULE_TTL . ', stale-while-revalidate=' . (SIGNAGE_CACHE_SCHEDULE_TTL * 2));
header('Expires: ' . signage_format_http_date(time() + SIGNAGE_CACHE_SCHEDULE_TTL));
header('ETag: ' . $etag);
header('Last-Modified: ' . signage_format_http_date($mtime));
header('X-Signage-Schedule-Version: ' . $version);
header('X-Signage-Schedule-Signature: ' . trim($etag, '"')); 

if (signage_should_return_not_modified($etag, $mtime)) {
    http_response_code(304);
    header('Content-Length: 0');
    return;
}

echo $json;
