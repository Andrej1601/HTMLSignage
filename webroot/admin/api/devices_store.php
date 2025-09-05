<?php
// /admin/api/devices_store.php – vollständige Helfer (ohne Platzhalter)
// Warum: Wird von /pair/* Endpunkten und Admin-API geteilt; zentrale, robuste Umsetzung.

const DEV_DB = '/var/www/signage/data/devices.json';

function dev_db_load(){
  if (!is_file(DEV_DB)) return ['version'=>1,'pairings'=>[],'devices'=>[]];
  $j = json_decode(@file_get_contents(DEV_DB), true);
  return is_array($j) ? $j : ['version'=>1,'pairings'=>[],'devices'=>[]];
}

function dev_db_save($db){
  @mkdir(dirname(DEV_DB), 02775, true);
  $json = json_encode($db, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT);
  $bytes = @file_put_contents(DEV_DB, $json, LOCK_EX);
  if ($bytes === false) {
    throw new RuntimeException('Unable to write device database');
  }
  @chmod(DEV_DB, 0644);
  @chown(DEV_DB,'www-data'); @chgrp(DEV_DB,'www-data');
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
