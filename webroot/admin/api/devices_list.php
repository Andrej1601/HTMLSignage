<?php
// /admin/api/devices_list.php – liefert getrennte Arrays { pairings, devices }
// Warum: Die Admin-UI erwartet dieses Format; gemischte Ausgabe verursachte
// "undefined"-Einträge & fehlschlagendes Löschen.

require_once __DIR__ . '/devices_lib.php';
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$db = devices_load();
$now = time();

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
  $devices[] = [
    'id' => $id,
    'name' => $d['name'] ?? $id,
    'lastSeenAt' => (int)($d['lastSeen'] ?? 0) ?: null,
    'useOverrides' => !empty($d['useOverrides']),
    'overrides' => [ 'settings' => $d['overrides']['settings'] ?? (object)[] ]
  ];
}

echo json_encode(['ok'=>true, 'pairings'=>$pairings, 'devices'=>$devices], JSON_UNESCAPED_SLASHES);
