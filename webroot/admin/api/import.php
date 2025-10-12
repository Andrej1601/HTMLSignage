<?php
require_once __DIR__ . '/storage.php';

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

@mkdir(signage_assets_path('img'), 02775, true);
@mkdir(signage_assets_path('media'), 02775, true);

function normalize_asset_rel($rel) {
  if (!is_string($rel) || $rel === '') return null;
  $normalized = '/' . ltrim(trim($rel), '/');
  if (!str_starts_with($normalized, '/assets/')) return null;
  return $normalized;
}

function ensure_asset_directory(string $relDir): ?string {
  $absolute = signage_absolute_path($relDir);
  if (!is_dir($absolute) && !@mkdir($absolute, 02775, true) && !is_dir($absolute)) {
    return null;
  }
  return $absolute;
}

$pathMap = []; // original rel path => new rel path
if ($writeAssets && !empty($j['blobs']) && is_array($j['blobs'])) {
  $i = 0;
  foreach ($j['blobs'] as $rel => $info) {
    $mime = $info['mime'] ?? 'application/octet-stream';
    $b64  = $info['b64'] ?? '';
    if (!$b64) continue;
    $originalRel = normalize_asset_rel(is_string($rel) ? $rel : ($info['rel'] ?? ''));
    $baseName = pathinfo($originalRel ?: ($info['name'] ?? ''), PATHINFO_FILENAME);
    if (!is_string($baseName) || $baseName === '') {
      $baseName = 'import';
    }
    $safeBase = preg_replace('/[^A-Za-z0-9._-]+/', '_', $baseName) ?: 'import';
    $extFromRel = strtolower(pathinfo($originalRel ?? '', PATHINFO_EXTENSION));
    $ext = $extFromRel ?: match($mime){
      'image/png' => 'png',
      'image/jpeg'=> 'jpg',
      'image/webp'=> 'webp',
      'image/svg+xml'=>'svg',
      'image/gif' => 'gif',
      'video/mp4' => 'mp4',
      'video/webm'=> 'webm',
      'video/ogg' => 'ogv',
      'audio/mpeg'=> 'mp3',
      'audio/ogg' => 'ogg',
      default => ($extFromRel ?: 'bin')
    };
    $relDir = $originalRel ? dirname($originalRel) : '/assets/img';
    if ($relDir === '/assets') {
      $relDir = '/assets/img';
    }
    $absDir = ensure_asset_directory($relDir);
    if ($absDir === null) continue;
    $stamp = date('Ymd_His');
    $outRel = rtrim($relDir, '/') . '/' . $safeBase . '_' . $stamp . '_' . ($i++) . '.' . $ext;
    $outAbs = signage_absolute_path($outRel);
    error_clear_last();
    $res = file_put_contents($outAbs, base64_decode($b64));
    if ($res === false) {
      $err = error_get_last();
      error_log("file_put_contents failed for $outAbs: ".($err['message'] ?? 'unknown error'));
      continue;
    }
    @chmod($outAbs, 0644);
    $pathMap[$rel] = $outRel;
    if ($originalRel && $originalRel !== $rel) {
      $pathMap[$originalRel] = $outRel;
    }
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
  $err = null;
  if (!signage_write_json('settings.json', $settings, $err)) {
    if ($err) error_log("file_put_contents failed for settings.json: $err");
    $ok1 = false;
  }
}
if ($writeSchedule && is_array($schedule)) {
  $err = null;
  if (!signage_write_json('schedule.json', $schedule, $err)) {
    if ($err) error_log("file_put_contents failed for schedule.json: $err");
    $ok2 = false;
  }
}
if (!$ok1 || !$ok2) fail('write-failed', 500);

echo json_encode(['ok'=>true, 'assetsWritten'=>count($pathMap), 'remapped'=>$pathMap]);
