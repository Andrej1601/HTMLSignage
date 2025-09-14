<?php
// /admin/api/devices_store.php – gemeinsame Helfer für Geräte-Datenbank
// Wird von Heartbeat- und Admin-APIs genutzt. Pfade werden zentral über
// devices_path() bestimmt, um harte Pfadangaben zu vermeiden.

function devices_path() {
  if (!empty($_ENV['DEVICES_PATH'])) return $_ENV['DEVICES_PATH'];
  $root = $_SERVER['DOCUMENT_ROOT'] ?? dirname(__DIR__, 2);
  return rtrim($root, '/') . '/data/devices.json';
}

function devices_load(){
  $p = devices_path();
  if (!is_file($p)) return ['version'=>1,'pairings'=>[],'devices'=>[]];
  $j = json_decode(@file_get_contents($p), true);
  return is_array($j) ? $j : ['version'=>1,'pairings'=>[],'devices'=>[]];
}

function devices_save($db){
  $p = devices_path();
  @mkdir(dirname($p), 02775, true);
  $json = json_encode($db, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT);
  $bytes = @file_put_contents($p, $json, LOCK_EX);
  if ($bytes === false) {
    throw new RuntimeException('Unable to write device database');
  }
  @chmod($p, 0644);
  @chown($p,'www-data'); @chgrp($p,'www-data');
  return true;
}

// Koppel-Code (AAAAAA) aus A–Z (ohne I/O) generieren; keine Speicherung hier
function dev_gen_code($db){
  $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  for ($i=0; $i<500; $i++) {
    $code = '';
    for ($j=0; $j<6; $j++) $code .= $alphabet[random_int(0, strlen($alphabet)-1)];
    if (empty($db['pairings'][$code])) return $code;
  }
  return null;
}

// Geräte-ID im Format dev_ + 12 hex (Regex im Player erwartet exakt das)
function dev_gen_id($db){
  for ($i=0; $i<1000; $i++) {
    $id = 'dev_'.bin2hex(random_bytes(6));
    if (empty($db['devices'][$id])) return $id;
  }
  return null;
}

// Aufräumen: offene Pairings >15min löschen; verwaiste Links bereinigen
function dev_gc(&$db){
  $now = time();
  foreach (($db['pairings'] ?? []) as $code => $p) {
    $age = $now - (int)($p['created'] ?? $now);
    if ($age > 900 && empty($p['deviceId'])) unset($db['pairings'][$code]);
    // Referenz auf nicht-existentes Device? -> lösen
    if (!empty($p['deviceId']) && empty($db['devices'][$p['deviceId']])) {
      $db['pairings'][$code]['deviceId'] = null;
    }
  }
}
