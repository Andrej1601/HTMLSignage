<?php
require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/storage.php';

auth_require_permission('system');

header('Content-Type: application/json; charset=UTF-8');
$imgDir = signage_assets_path('img');
$mediaDir = signage_assets_path('media');

if (!is_dir($imgDir) && !@mkdir($imgDir, 02775, true) && !is_dir($imgDir)) {
  echo json_encode(['ok'=>false,'error'=>'missing-assets-dir']); exit;
}
if (!is_dir($mediaDir) && !@mkdir($mediaDir, 02775, true) && !is_dir($mediaDir)) {
  echo json_encode(['ok'=>false,'error'=>'missing-assets-dir']); exit;
}

$cfg = signage_read_json('settings.json');
$schedule = signage_read_json('schedule.json');
$keep = [];

$removeSauna = isset($_GET['sauna']) && $_GET['sauna'] === '1';
$removeInter = isset($_GET['inter']) && $_GET['inter'] === '1';
$removeFlame = isset($_GET['flame']) && $_GET['flame'] === '1';

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

$settingsScan = $cfg;
if ($removeSauna && isset($settingsScan['assets']['rightImages'])) {
  unset($settingsScan['assets']['rightImages']);
}
if ($removeFlame && isset($settingsScan['assets']['flameImage'])) {
  unset($settingsScan['assets']['flameImage']);
}
if ($removeInter && isset($settingsScan['interstitials'])) {
  unset($settingsScan['interstitials']);
}

collectAssetStrings($settingsScan, $keep);
collectAssetStrings($schedule, $keep);

if (!$removeFlame && !empty($cfg['assets']['flameImage'])) pushAssetPath($keep, $cfg['assets']['flameImage']);
if (!$removeSauna && !empty($cfg['assets']['rightImages']) && is_array($cfg['assets']['rightImages'])) {
  foreach($cfg['assets']['rightImages'] as $p){ if($p) pushAssetPath($keep, $p); }
}
if (!$removeInter && !empty($cfg['interstitials']) && is_array($cfg['interstitials'])) {
  foreach($cfg['interstitials'] as $it){
    if (!is_array($it)) continue;
    foreach(['url','thumb'] as $k){
      $p = $it[$k] ?? '';
      pushAssetPath($keep, $p);
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
$keepReal = array_map(function($p){ return signage_absolute_path($p); }, array_keys($keepMap));

$basePath = signage_base_path();

$removed = [];
$directories = array_filter([$imgDir, $mediaDir], 'is_dir');
foreach ($directories as $dir) {
  $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
  foreach ($it as $f){
    if(!$f->isFile()) continue;
    $full = $f->getPathname();
    if (!in_array($full, $keepReal, true)){
      @unlink($full);
      if(!file_exists($full)) {
        $removed[] = str_starts_with($full, $basePath)
          ? substr($full, strlen($basePath))
          : $full;
      }
    }
  }
}

echo json_encode(['ok'=>true,'removed'=>$removed]);
