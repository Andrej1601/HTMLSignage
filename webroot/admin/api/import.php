<?php
header('Content-Type: application/json; charset=UTF-8');

function fail($m,$c=400){ http_response_code($c); echo json_encode(['ok'=>false,'error'=>$m]); exit; }

$raw = '';
if (!empty($_FILES['file']['tmp_name'])) {
  $raw = file_get_contents($_FILES['file']['tmp_name']);
} else {
  $raw = file_get_contents('php://input');
}
if ($raw==='') fail('no-data');

$j = json_decode($raw, true);
if (!$j || ($j['kind']??'')!=='signage-export') fail('bad-format');

$writeAssets   = !empty($_POST['writeAssets']) || !empty($_GET['writeAssets']);
$writeSettings = isset($_POST['writeSettings']) ? ($_POST['writeSettings']==='1') : true;
$writeSchedule = isset($_POST['writeSchedule']) ? ($_POST['writeSchedule']==='1') : true;
$settings = $j['settings'] ?? null; $schedule = $j['schedule'] ?? null;
$hasSettings = array_key_exists('settings', $j);
$hasSchedule = array_key_exists('schedule', $j);
if (!$hasSettings && !$hasSchedule) fail('missing-sections');

$base = '/var/www/signage';
$assetsDir = $base.'/assets/img';
@mkdir($assetsDir, 02775, true);

$pathMap = []; // original rel path => new rel path
if ($writeAssets && !empty($j['blobs']) && is_array($j['blobs'])) {
  $i = 0;
  foreach ($j['blobs'] as $rel => $info) {
    $mime = $info['mime'] ?? 'application/octet-stream';
    $b64  = $info['b64'] ?? '';
    if (!$b64) continue;
    $ext = match($mime){
      'image/png' => 'png',
      'image/jpeg'=> 'jpg',
      'image/webp'=> 'webp',
      'image/svg+xml'=>'svg',
      default => 'bin'
    };
    $name = pathinfo($info['name'] ?? basename($rel), PATHINFO_FILENAME);
    $outRel = '/assets/img/import_'.date('Ymd_His').'_'.($i++).'.'.$ext;
    $outAbs = $base.$outRel;
    file_put_contents($outAbs, base64_decode($b64));
    @chmod($outAbs, 0644);
    $pathMap[$rel] = $outRel;
  }

  // remap settings asset paths to the newly written files (if present)
  if (!empty($settings['assets']['flameImage']) && isset($pathMap[$settings['assets']['flameImage']])) {
    $settings['assets']['flameImage'] = $pathMap[$settings['assets']['flameImage']];
  }
  if (!empty($settings['assets']['rightImages']) && is_array($settings['assets']['rightImages'])) {
    foreach ($settings['assets']['rightImages'] as $k=>$p) {
      if (isset($pathMap[$p])) $settings['assets']['rightImages'][$k] = $pathMap[$p];
    }
  }
}

// bump versions (nur wenn vorhanden & aktiviert)
if ($writeSettings && is_array($settings)) $settings['version'] = time();
if ($writeSchedule && is_array($schedule)) $schedule['version'] = time();

$ok1 = true; $ok2 = true;
if ($writeSettings && is_array($settings)) {
  $ok1 = (bool)file_put_contents($base.'/data/settings.json', json_encode($settings, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT));
}
if ($writeSchedule && is_array($schedule)) {
  $ok2 = (bool)file_put_contents($base.'/data/schedule.json', json_encode($schedule, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT));
}
if (!$ok1 || !$ok2) fail('write-failed', 500);

echo json_encode(['ok'=>true, 'assetsWritten'=>count($pathMap), 'remapped'=>$pathMap]);
