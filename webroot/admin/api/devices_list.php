<?php
// /admin/api/devices_list.php – liefert getrennte Arrays { pairings, devices }
// Warum: Die Admin-UI erwartet dieses Format; gemischte Ausgabe verursachte
// "undefined"-Einträge & fehlschlagendes Löschen.

require_once __DIR__ . '/devices_store.php';
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

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
foreach (($db['devices'] ?? []) as $key => $d) {

  $id = $key;
  if (is_int($key) || (is_string($key) && ctype_digit($key))) {
    $id = $d['id'] ?? (string)$key;
  }

  $last = isset($d['lastSeenAt']) ? (int)$d['lastSeenAt'] : (int)($d['lastSeen'] ?? 0);
  $offline = !$last || ($now - $last) > OFFLINE_AFTER_MIN * 60;

  $devices[] = [
    'id' => $id,
    'name' => $d['name'] ?? $id,
    'lastSeenAt' => $last ?: null,
    'offline' => $offline,
    'useOverrides' => !empty($d['useOverrides']),
    'overrides' => [
      'settings' => $d['overrides']['settings'] ?? (object)[],
      'schedule' => $d['overrides']['schedule'] ?? (object)[]
    ]
  ];

}

echo json_encode([
  'ok' => true,
  'now' => $now,
  'pairings' => $pairings,
  'devices' => $devices
], JSON_UNESCAPED_SLASHES);
