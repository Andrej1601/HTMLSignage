<?php
require_once __DIR__ . '/storage.php';

header('Content-Type: application/json; charset=UTF-8');

function get_flag(string $name, int $default=1): int {
  if (!isset($_GET[$name])) return $default;
  $v = strtolower((string)$_GET[$name]);
  return in_array($v, ['1','true','yes','on'], true) ? 1 : 0;
}

function gather_asset_paths($source): array {
  $paths = [];
  $stack = [$source];
  while (!empty($stack)) {
    $current = array_pop($stack);
    if (is_array($current)) {
      foreach ($current as $value) {
        $stack[] = $value;
      }
      continue;
    }
    if (!is_string($current)) continue;
    if (strpos($current, '/assets/') === false) continue;
    if (preg_match_all('~(/assets/[A-Za-z0-9_./\-]+)~', $current, $matches)) {
      foreach ($matches[1] as $rel) {
        $paths[$rel] = true;
      }
    }
  }
  return array_keys($paths);
}

$settingsFile = signage_data_path('settings.json');
$scheduleFile = signage_data_path('schedule.json');
$include     = get_flag('include', 0);  // Bilder
$incSettings = get_flag('settings', 1);
$incSchedule = get_flag('schedule', 1);

if (($incSettings || $include) && !is_file($settingsFile)) {
  http_response_code(404);
  echo json_encode(['ok'=>false,'error'=>'missing-settings']); exit;
}
if (($incSchedule || $include) && !is_file($scheduleFile)) {
  http_response_code(404);
  echo json_encode(['ok'=>false,'error'=>'missing-schedule']); exit;
}

$settings = ($incSettings || $include) ? signage_read_json('settings.json') : null;
$schedule = ($incSchedule || $include) ? signage_read_json('schedule.json') : null;

$out = [
  'kind'       => 'signage-export',
  'version'    => 1,
  'exportedAt' => gmdate('c'),
  'includeImages' => $include ? true : false,
];
if ($incSettings) $out['settings'] = $settings;
if ($incSchedule) $out['schedule'] = $schedule;

if ($include) {
  $pathSet = [];
  if ($incSettings && is_array($settings)) {
    foreach (gather_asset_paths($settings) as $rel) {
      $pathSet[$rel] = true;
    }
  }
  if ($incSchedule && is_array($schedule)) {
    foreach (gather_asset_paths($schedule) as $rel) {
      $pathSet[$rel] = true;
    }
  }
  if (!empty($pathSet)) {
    $blobs = [];
    $fi = new finfo(FILEINFO_MIME_TYPE);
    foreach (array_keys($pathSet) as $rel) {
      if (!is_string($rel) || !str_starts_with($rel, '/assets/')) continue;
      $abs = signage_absolute_path($rel);
      if (!is_file($abs)) continue;
      $mime = $fi->file($abs) ?: 'application/octet-stream';
      $b64  = base64_encode(file_get_contents($abs));
      $blobs[$rel] = ['mime'=>$mime, 'b64'=>$b64, 'name'=>basename($abs), 'rel'=>$rel];
    }
    if (!empty($blobs)) $out['blobs'] = $blobs;
  }
}

$name = isset($_GET['name']) ? preg_replace('/[^A-Za-z0-9_.-]/','_', $_GET['name']) : ('signage_export_'.date('Ymd'));
header('Content-Disposition: attachment; filename="'.$name.($include?'_with-images':'').'.json"');
echo json_encode($out, SIGNAGE_JSON_FLAGS);
