<?php
header('Content-Type: application/json; charset=UTF-8');
$assetsDir = '/var/www/signage/assets/media';
$settingsFile = '/var/www/signage/data/settings.json';

if (!is_dir($assetsDir)) { echo json_encode(['ok'=>false,'error'=>'missing-assets-dir']); exit; }
$cfg = is_file($settingsFile) ? json_decode(file_get_contents($settingsFile), true) : [];
$keep = [];

if (!empty($cfg['assets']['flameImage'])) $keep[] = $cfg['assets']['flameImage'];
if (!empty($cfg['assets']['rightImages']) && is_array($cfg['assets']['rightImages'])) {
  foreach($cfg['assets']['rightImages'] as $p){ if($p) $keep[]=$p; }
}
if (!empty($cfg['interstitials']) && is_array($cfg['interstitials'])) {
  foreach($cfg['interstitials'] as $it){
    if (!is_array($it)) continue;
    foreach(['url','thumb'] as $k){
      $p = $it[$k] ?? '';
      if (is_string($p) && strpos($p,'/assets/') === 0) $keep[] = $p;
    }
  }
}

$keepReal = array_map(function($p){ return '/var/www/signage'. $p; }, array_unique($keep));

$removed = [];
$it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($assetsDir, FilesystemIterator::SKIP_DOTS));
foreach ($it as $f){
  if(!$f->isFile()) continue;
  $full = $f->getPathname();
  if (!in_array($full, $keepReal, true)){
    @unlink($full);
    if(!file_exists($full)) $removed[] = str_replace('/var/www/signage','', $full);
  }
}

echo json_encode(['ok'=>true,'removed'=>$removed]);
