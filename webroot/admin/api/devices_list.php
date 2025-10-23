<?php
// /admin/api/devices_list.php – liefert getrennte Arrays { pairings, devices }
// Warum: Die Admin-UI erwartet dieses Format; gemischte Ausgabe verursachte
// "undefined"-Einträge & fehlschlagendes Löschen.

require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/devices_store.php';
auth_require_role('editor');
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: private, must-revalidate, max-age=3, stale-while-revalidate=30');

function devices_list_client_sent_etag(string $etag): bool
{
  if (empty($_SERVER['HTTP_IF_NONE_MATCH'])) {
    return false;
  }

  $requested = array_filter(array_map('trim', explode(',', $_SERVER['HTTP_IF_NONE_MATCH'])));
  foreach ($requested as $candidate) {
    if ($candidate === '*' || $candidate === $etag) {
      return true;
    }
  }

  return false;
}

$db = devices_load();
$now = time();
// Geräte gelten nach dieser Anzahl von Minuten ohne Heartbeat als offline.
if (!defined('OFFLINE_AFTER_MIN')) define('OFFLINE_AFTER_MIN', 2);

$pairings = [];
foreach (($db['pairings'] ?? []) as $code => $row) {
 if (!empty($row['deviceId'])) continue; // nur offene Codes anzeigen
 $created = (int)($row['created'] ?? 0);
 $pairings[] = [
 'code' => $row['code'] ?? $code,
 'createdAt' => $created,
 'expiresAt' => $created ? ($created + 900) : null
 ];
}
usort($pairings, fn($a,$b)=>($b['createdAt']??0)-($a['createdAt']??0));

$devices = [];
foreach (($db['devices'] ?? []) as $id => $d) {
  if (!is_array($d)) {
    continue;
  }
  $deviceId = is_string($id) ? $id : ($d['id'] ?? '');
  if (!devices_is_valid_id($deviceId)) {
    continue;
  }

  $last = isset($d['lastSeenAt']) ? (int)$d['lastSeenAt'] : (int)($d['lastSeen'] ?? 0);
  $offline = !$last || ($now - $last) > OFFLINE_AFTER_MIN * 60;

  $overrides = isset($d['overrides']) && is_array($d['overrides']) ? $d['overrides'] : [];

  $devices[] = [
    'id' => $deviceId,
    'name' => isset($d['name']) && is_string($d['name']) ? $d['name'] : $deviceId,
    'lastSeenAt' => $last ?: null,
    'offline' => $offline,
    'useOverrides' => !empty($d['useOverrides']),
    'overrides' => [
      'settings' => $overrides['settings'] ?? (object)[],
      'schedule' => $overrides['schedule'] ?? (object)[]
    ],
    'status' => isset($d['status']) && is_array($d['status']) ? $d['status'] : (object)[],
    'metrics' => isset($d['metrics']) && is_array($d['metrics']) ? $d['metrics'] : (object)[],
    'heartbeatHistory' => isset($d['heartbeatHistory']) && is_array($d['heartbeatHistory'])
      ? array_slice(array_values($d['heartbeatHistory']), -10)
      : []
  ];
}

$payload = [
  'ok' => true,
  'now' => $now,
  'pairings' => $pairings,
  'devices' => $devices
];

$json = json_encode($payload, JSON_UNESCAPED_SLASHES);
if ($json === false) {
  http_response_code(500);
  echo json_encode([
    'ok' => false,
    'error' => 'Geräteliste konnte nicht serialisiert werden.'
  ], JSON_UNESCAPED_SLASHES);
  return;
}

$etag = '"' . substr(hash('sha256', $json), 0, 32) . '"';
header('ETag: ' . $etag);

if (devices_list_client_sent_etag($etag)) {
  http_response_code(304);
  return;
}

echo $json;
