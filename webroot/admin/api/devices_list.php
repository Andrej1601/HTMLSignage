<?php
// /admin/api/devices_list.php – liefert getrennte Arrays { pairings, devices }
// Warum: Die Admin-UI erwartet dieses Format; gemischte Ausgabe verursachte
// "undefined"-Einträge & fehlschlagendes Löschen.

require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/devices_store.php';

auth_require_role('editor');

$state = devices_load();
$now = time();
$payloadData = devices_build_list_payload($state, $now);

$payload = [
    'ok' => true,
    'now' => $now,
    'pairings' => $payloadData['pairings'],
    'devices' => $payloadData['devices'],
];

$json = json_encode($payload, SIGNAGE_JSON_RESPONSE_FLAGS);
if ($json === false) {
    header('Content-Type: application/json; charset=UTF-8');
    signage_json_response([
        'ok' => false,
        'error' => 'Geräteliste konnte nicht serialisiert werden.',
    ], 500);
    return;
}

$etag = '"' . substr(hash('sha256', $json), 0, 32) . '"';
$lastModified = devices_state_last_activity($state);

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: private, must-revalidate, max-age=3, stale-while-revalidate=30');
header('ETag: ' . $etag);
if ($lastModified > 0) {
    header('Last-Modified: ' . signage_format_http_date($lastModified));
}

if (signage_should_return_not_modified($etag, $lastModified)) {
    http_response_code(304);
    header('Content-Length: 0');
    return;
}

echo $json;
