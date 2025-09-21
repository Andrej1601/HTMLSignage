<?php
header('Content-Type: application/json; charset=UTF-8');

function fail($m,$c=400){ http_response_code($c); echo json_encode(['ok'=>false,'error'=>$m]); exit; }

function remap_asset_paths(&$value, array $map): void {
  if (empty($map)) return;
  if (is_array($value)) {
    foreach ($value as &$item) {
      remap_asset_paths($item, $map);
    }
    unset($item);
    return;
  }
  if (!is_string($value)) return;
  $trimmed = trim($value);
  if ($trimmed === '') return;
  if (isset($map[$trimmed])) {
    $value = $map[$trimmed];
    return;
  }
  if (preg_match('~^(/assets/[A-Za-z0-9_./\-]+)(\?[^\s]*)?$~', $trimmed, $m)) {
    $path = $m[1];
    if (isset($map[$path])) {
      $suffix = $m[2] ?? '';
      $value = $map[$path] . $suffix;
    }
  }
}

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
    error_clear_last();
    $res = file_put_contents($outAbs, base64_decode($b64));
    if ($res === false) {
      $err = error_get_last();
      error_log("file_put_contents failed for $outAbs: ".($err['message'] ?? 'unknown error'));
      continue;
    }
    @chmod($outAbs, 0644);
    $pathMap[$rel] = $outRel;
  }

  if (!empty($pathMap)) {
    if (is_array($settings)) remap_asset_paths($settings, $pathMap);
    if (is_array($schedule)) remap_asset_paths($schedule, $pathMap);
  }
}

// bump versions (nur wenn vorhanden & aktiviert)
if ($writeSettings && is_array($settings)) $settings['version'] = time();
if ($writeSchedule && is_array($schedule)) $schedule['version'] = time();

$ok1 = true; $ok2 = true;
if ($writeSettings && is_array($settings)) {
  $settingsFile = $base.'/data/settings.json';
  error_clear_last();
  $res = file_put_contents($settingsFile, json_encode($settings, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT));
  if ($res === false) {
    $err = error_get_last();
    error_log("file_put_contents failed for $settingsFile: ".($err['message'] ?? 'unknown error'));
    $ok1 = false;
  }
}
if ($writeSchedule && is_array($schedule)) {
  $scheduleFile = $base.'/data/schedule.json';
  error_clear_last();
  $res = file_put_contents($scheduleFile, json_encode($schedule, JSON_UNESCAPED_SLASHES|JSON_PRETTY_PRINT));
  if ($res === false) {
    $err = error_get_last();
    error_log("file_put_contents failed for $scheduleFile: ".($err['message'] ?? 'unknown error'));
    $ok2 = false;
  }
}
if (!$ok1 || !$ok2) fail('write-failed', 500);

echo json_encode(['ok'=>true, 'assetsWritten'=>count($pathMap), 'remapped'=>$pathMap]);
