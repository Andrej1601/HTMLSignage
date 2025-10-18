<?php
require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/storage.php';

auth_require_permission('system');

header('Content-Type: application/json; charset=UTF-8');

function fail($m,$c=400){ http_response_code($c); echo json_encode(['ok'=>false,'error'=>$m]); exit; }

const SIGNAGE_IMPORT_MAX_JSON_BYTES = 8 * 1024 * 1024; // 8 MiB
const SIGNAGE_IMPORT_MAX_BLOB_BYTES = 25 * 1024 * 1024; // 25 MiB

function signage_import_read_payload(?string $path, int $limit, bool &$overflow): string {
  $overflow = false;
  $stream = $path !== null ? @fopen($path, 'rb') : @fopen('php://input', 'rb');
  if ($stream === false) {
    return '';
  }
  $buffer = '';
  $chunkSize = 65536;
  while (!feof($stream)) {
    $remaining = $limit + 1 - strlen($buffer);
    if ($remaining <= 0) {
      $overflow = true;
      break;
    }
    $chunk = fread($stream, min($chunkSize, $remaining));
    if ($chunk === false) {
      break;
    }
    if ($chunk === '') {
      break;
    }
    $buffer .= $chunk;
  }
  if (!$overflow && !feof($stream)) {
    $overflow = true;
  }
  fclose($stream);
  return $buffer;
}

function signage_import_decode_blob(string $b64, string $outAbs, int $maxBytes): bool {
  $handle = @fopen($outAbs, 'wb');
  if ($handle === false) {
    return false;
  }
  $buffer = '';
  $total = 0;
  $chunkSize = 8192;
  $length = strlen($b64);
  for ($offset = 0; $offset < $length; $offset += $chunkSize) {
    $buffer .= substr($b64, $offset, $chunkSize);
    $consume = strlen($buffer) - (strlen($buffer) % 4);
    if ($consume === 0 && $offset + $chunkSize < $length) {
      continue;
    }
    $chunk = substr($buffer, 0, $consume);
    $buffer = substr($buffer, $consume);
    if ($chunk === '') {
      continue;
    }
    $decoded = base64_decode($chunk, true);
    if ($decoded === false) {
      @fclose($handle);
      @unlink($outAbs);
      return false;
    }
    $total += strlen($decoded);
    if ($maxBytes > 0 && $total > $maxBytes) {
      @fclose($handle);
      @unlink($outAbs);
      return false;
    }
    if ($decoded !== '' && @fwrite($handle, $decoded) === false) {
      @fclose($handle);
      @unlink($outAbs);
      return false;
    }
  }
  if ($buffer !== '') {
    $decoded = base64_decode($buffer, true);
    if ($decoded === false) {
      @fclose($handle);
      @unlink($outAbs);
      return false;
    }
    $total += strlen($decoded);
    if ($maxBytes > 0 && $total > $maxBytes) {
      @fclose($handle);
      @unlink($outAbs);
      return false;
    }
    if ($decoded !== '' && @fwrite($handle, $decoded) === false) {
      @fclose($handle);
      @unlink($outAbs);
      return false;
    }
  }

  @fflush($handle);
  if (function_exists('fsync')) {
    @fsync($handle);
  }
  @fclose($handle);
  return true;
}

function signage_import_estimate_base64_size(string $b64): int {
  $clean = rtrim($b64, "\r\n");
  $len = strlen($clean);
  if ($len === 0) {
    return 0;
  }
  $padding = 0;
  if ($clean[$len - 1] === '=') {
    $padding++;
    if ($len > 1 && $clean[$len - 2] === '=') {
      $padding++;
    }
  }
  return (int) ((intdiv($len, 4) * 3) - $padding);
}

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
$overflow = false;
if (!empty($_FILES['file']['tmp_name'])) {
  if (!empty($_FILES['file']['error']) && $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    fail('upload-failed', 400);
  }
  if (isset($_FILES['file']['size']) && $_FILES['file']['size'] > SIGNAGE_IMPORT_MAX_JSON_BYTES) {
    fail('payload-too-large', 413);
  }
  $raw = signage_import_read_payload($_FILES['file']['tmp_name'], SIGNAGE_IMPORT_MAX_JSON_BYTES, $overflow);
} else {
  $raw = signage_import_read_payload(null, SIGNAGE_IMPORT_MAX_JSON_BYTES, $overflow);
}

if ($overflow || strlen($raw) > SIGNAGE_IMPORT_MAX_JSON_BYTES) {
  fail('payload-too-large', 413);
}
if ($raw === '') {
  fail('no-data');
}

$j = json_decode($raw, true);
if (!is_array($j) || ($j['kind']??'')!=='signage-export') fail('bad-format');

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
    $estimatedSize = signage_import_estimate_base64_size($b64);
    if (SIGNAGE_IMPORT_MAX_BLOB_BYTES > 0 && $estimatedSize > SIGNAGE_IMPORT_MAX_BLOB_BYTES) {
      error_log("skipping asset $outAbs: exceeds size limit");
      continue;
    }
    if (!signage_import_decode_blob($b64, $outAbs, SIGNAGE_IMPORT_MAX_BLOB_BYTES)) {
      $err = error_get_last();
      error_log("failed to write decoded blob for $outAbs: ".($err['message'] ?? 'unknown error'));
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
