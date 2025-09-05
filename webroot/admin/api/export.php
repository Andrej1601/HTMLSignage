<?php
header('Content-Type: application/json; charset=UTF-8');

function get_flag(string $name, int $default=1): int {
  if (!isset($_GET[$name])) return $default;
  $v = strtolower((string)$_GET[$name]);
  return in_array($v, ['1','true','yes','on'], true) ? 1 : 0;
}

$settingsFile = '/var/www/signage/data/settings.json';
$scheduleFile = '/var/www/signage/data/schedule.json';
if (!is_file($settingsFile) || !is_file($scheduleFile)) {
  http_response_code(404);
  echo json_encode(['ok'=>false,'error'=>'missing-data']); exit;
}

$settings = json_decode(file_get_contents($settingsFile), true);
$schedule = json_decode(file_get_contents($scheduleFile), true);
$include     = get_flag('include', 0);  // Bilder
$incSettings = get_flag('settings', 1);
$incSchedule = get_flag('schedule', 1);

$out = [
  'kind'       => 'signage-export',
  'version'    => 1,
  'exportedAt' => gmdate('c'),
  'includeImages' => $include ? true : false,
];
if ($incSettings) $out['settings'] = $settings;
if ($incSchedule) $out['schedule'] = $schedule;

if ($include && $incSettings) {
  $paths = [];
  if (!empty($settings['assets']['flameImage'])) $paths[] = $settings['assets']['flameImage'];
  if (!empty($settings['assets']['rightImages']) && is_array($settings['assets']['rightImages'])) {
    foreach ($settings['assets']['rightImages'] as $p) if ($p) $paths[] = $p;
  }
  $paths = array_values(array_unique(array_filter($paths, fn($p)=>is_string($p) && str_starts_with($p,'/assets/img/'))));
  $blobs = [];
  $base = '/var/www/signage';
  $fi = new finfo(FILEINFO_MIME_TYPE);
  foreach ($paths as $rel) {
    $abs = $base . $rel;
    if (!is_file($abs)) continue;
    $mime = $fi->file($abs) ?: 'application/octet-stream';
    $b64  = base64_encode(file_get_contents($abs));
    $blobs[$rel] = ['mime'=>$mime, 'b64'=>$b64, 'name'=>basename($abs), 'rel'=>$rel];
  }
  $out['blobs'] = $blobs;
}

$name = isset($_GET['name']) ? preg_replace('/[^A-Za-z0-9_.-]/','_', $_GET['name']) : ('signage_export_'.date('Ymd'));
header('Content-Disposition: attachment; filename="'.$name.($include?'_with-images':'').'.json"');
echo json_encode($out, JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT);
