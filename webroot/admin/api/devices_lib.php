<?php
// admin/api/devices_lib.php
function devices_path() {
  return $_SERVER['DOCUMENT_ROOT'].'/data/devices.json';
}
function devices_load() {
  $p = devices_path();
  if (!file_exists($p)) return ['version'=>1,'devices'=>[],'pairings'=>[]];
  $j = json_decode(file_get_contents($p), true);
  return is_array($j) ? $j : ['version'=>1,'devices'=>[],'pairings'=>[]];
}
function devices_save($data) {
  $p = devices_path();
  $tmp = $p.'.tmp';
  if (!is_dir(dirname($p))) mkdir(dirname($p), 0775, true);
  $ok = file_put_contents($tmp, json_encode($data, JSON_PRETTY_PRINT|JSON_UNESCAPED_SLASHES)) !== false;
  if ($ok) $ok = rename($tmp, $p);
  return $ok;
}
