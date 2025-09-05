<?php
header('Content-Type: application/json; charset=UTF-8');
$assetsDir = '/var/www/signage/assets/img';
$settingsFile = '/var/www/signage/data/settings.json';

if (!is_dir($assetsDir)) { echo json_encode(['ok'=>false,'error'=>'missing-assets-dir']); exit; }
$cfg = is_file($settingsFile) ? json_decode(file_get_contents($settingsFile), true) : [];
$keep = [];
$keep[] = '/assets/img/right_default.svg';
$keep[] = '/assets/img/flame_test.svg';

if (!empty($cfg['assets']['flameImage'])) $keep[] = $cfg['assets']['flameImage'];
if (!empty($cfg['assets']['rightImages']) && is_array($cfg['assets']['rightImages'])) {
  foreach($cfg['assets']['rightImages'] as $p){ if($p) $keep[]=$p; }
}

$keepReal = array_map(function($p){ return '/var/www/signage'. $p; }, array_unique($keep));

$removed = [];
$it = new DirectoryIterator($assetsDir);
foreach ($it as $f){ if($f->isDot()||!$f->isFile()) continue; $full = $f->getPathname(); if (!in_array($full, $keepReal, true)) { @unlink($full); if(!file_exists($full)) $removed[] = str_replace('/var/www/signage','', $full); } }

echo json_encode(['ok'=>true,'removed'=>$removed]);
