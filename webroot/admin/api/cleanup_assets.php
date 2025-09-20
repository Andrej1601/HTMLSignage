<?php
header('Content-Type: application/json; charset=UTF-8');
$assetsDir = '/var/www/signage/assets/media';
$settingsFile = '/var/www/signage/data/settings.json';

if (!is_dir($assetsDir)) { echo json_encode(['ok'=>false,'error'=>'missing-assets-dir']); exit; }
$cfg = is_file($settingsFile) ? json_decode(file_get_contents($settingsFile), true) : [];
$keep = [];

function stripCacheSimple($url){
  if (!is_string($url)) return '';
  $url = trim($url);
  if ($url === '') return '';
  $pos = strcspn($url, '?#');
  if ($pos < strlen($url)) {
    $url = substr($url, 0, $pos);
  }
  if ($url === '') return '';
  if ($url[0] !== '/') {
    if (strpos($url, 'assets/') === 0) {
      $url = '/' . $url;
    } else {
      return '';
    }
  }
  return $url;
}

function pushAssetPath(&$list, $value){
  if (is_string($value) || is_numeric($value)) {
    $clean = stripCacheSimple((string)$value);
    if ($clean && strpos($clean, '/assets/') === 0) {
      $list[] = $clean;
    }
  }
}

function collectAssetStrings($value, &$list){
  if (is_array($value)) {
    foreach ($value as $item) {
      collectAssetStrings($item, $list);
    }
    return;
  }
  pushAssetPath($list, $value);
}

if (!empty($cfg['assets']['flameImage'])) pushAssetPath($keep, $cfg['assets']['flameImage']);
if (!empty($cfg['assets']['rightImages']) && is_array($cfg['assets']['rightImages'])) {
  foreach($cfg['assets']['rightImages'] as $p){ if($p) pushAssetPath($keep, $p); }
}
if (!empty($cfg['interstitials']) && is_array($cfg['interstitials'])) {
  foreach($cfg['interstitials'] as $it){
    if (!is_array($it)) continue;
    foreach(['url','thumb'] as $k){
      $p = $it[$k] ?? '';
      pushAssetPath($keep, $p);
    }
  }
}

if (!empty($cfg['slides']) && is_array($cfg['slides'])) {
  $slides = $cfg['slides'];
  if (!empty($slides['badgeLibrary']) && is_array($slides['badgeLibrary'])) {
    collectAssetStrings($slides['badgeLibrary'], $keep);
  }
  if (!empty($slides['storySlides']) && is_array($slides['storySlides'])) {
    foreach ($slides['storySlides'] as $story){
      if (!is_array($story)) continue;
      collectAssetStrings($story, $keep);
    }
  }
  if (!empty($slides['styleSets']) && is_array($slides['styleSets'])) {
    foreach ($slides['styleSets'] as $styleSet){
      if (!is_array($styleSet)) continue;
      collectAssetStrings($styleSet, $keep);
    }
  }
}

$keepMap = [];
foreach ($keep as $p) {
  $clean = stripCacheSimple($p);
  if ($clean && strpos($clean, '/assets/') === 0) {
    $keepMap[$clean] = true;
  }
}
$keepReal = array_map(function($p){ return '/var/www/signage'. $p; }, array_keys($keepMap));

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
