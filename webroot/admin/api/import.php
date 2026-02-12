<?php
require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/storage.php';

auth_require_permission('module-system');

header('Content-Type: application/json; charset=UTF-8');

function fail($m,$c=400){ http_response_code($c); echo json_encode(['ok'=>false,'error'=>$m]); exit; }

class ImportException extends RuntimeException {
  public string $errorCode;
  public int $statusCode;

  public function __construct(string $errorCode, int $statusCode = 400, string $message = '')
  {
    parent::__construct($message !== '' ? $message : $errorCode, $statusCode);
    $this->errorCode = $errorCode;
    $this->statusCode = $statusCode;
  }
}

function normalize_asset_rel($rel) {
  if (!is_string($rel) || $rel === '') return null;
  $normalized = '/' . ltrim(trim($rel), '/');
  if (!str_starts_with($normalized, '/assets/')) return null;
  return $normalized;
}

function import_is_sqlite(string $raw): bool {
  return strncmp($raw, 'SQLite format 3', 15) === 0;
}

function import_parse_json(string $raw): array {
  $decoded = json_decode($raw, true);
  if (!is_array($decoded) || ($decoded['kind'] ?? '') !== 'signage-export') {
    throw new ImportException('bad-format');
  }

  $assets = [];
  if (!empty($decoded['blobs']) && is_array($decoded['blobs'])) {
    foreach ($decoded['blobs'] as $rel => $info) {
      $mime = is_string($info['mime'] ?? null) ? $info['mime'] : 'application/octet-stream';
      $b64  = is_string($info['b64'] ?? null) ? $info['b64'] : '';
      if ($b64 === '') continue;
      $data = base64_decode($b64, true);
      if ($data === false) continue;
      $originalRel = normalize_asset_rel(is_string($rel) ? $rel : ($info['rel'] ?? ''));
      $aliases = [];
      if (is_string($rel) && $rel !== '') {
        $aliases[] = $rel;
      }
      if (is_string($info['rel'] ?? null) && $info['rel'] !== $rel) {
        $aliases[] = $info['rel'];
      }
      $assets[] = [
        'mime' => $mime,
        'name' => is_string($info['name'] ?? null) ? $info['name'] : null,
        'data' => $data,
        'originalRel' => $originalRel,
        'aliases' => $aliases,
      ];
    }
  }

  return [
    'settings' => $decoded['settings'] ?? null,
    'schedule' => $decoded['schedule'] ?? null,
    'hasSettings' => array_key_exists('settings', $decoded),
    'hasSchedule' => array_key_exists('schedule', $decoded),
    'assets' => $assets,
  ];
}

function import_parse_sqlite(string $path): array {
  if (!class_exists('\\PDO') || (!extension_loaded('pdo_sqlite') && !extension_loaded('sqlite3'))) {
    throw new ImportException('sqlite-unavailable', 500);
  }

  try {
    $pdo = new \PDO('sqlite:' . $path, null, null, [
      \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
      \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
      \PDO::ATTR_EMULATE_PREPARES => false,
    ]);
  } catch (Throwable $exception) {
    error_log('import: unable to open sqlite export: ' . $exception->getMessage());
    throw new ImportException('sqlite-open-failed', 400, $exception->getMessage());
  }

  try {
    $meta = [];
    $metaStmt = $pdo->query('SELECT key, value FROM export_meta');
    if ($metaStmt !== false) {
      foreach ($metaStmt as $row) {
        if (!isset($row['key'])) continue;
        $meta[$row['key']] = (string) ($row['value'] ?? '');
      }
    }
    if (($meta['kind'] ?? '') !== 'signage-export') {
      throw new ImportException('bad-format');
    }

    $stateStmt = $pdo->query('SELECT section, json FROM export_state');
    $settings = null;
    $schedule = null;
    $hasSettings = false;
    $hasSchedule = false;
    if ($stateStmt !== false) {
      foreach ($stateStmt as $row) {
        $section = $row['section'] ?? '';
        $json = $row['json'] ?? '';
        if (!is_string($section) || $section === '' || !is_string($json)) continue;
        $decoded = json_decode($json, true);
        if ($section === 'settings') {
          $settings = $decoded;
          $hasSettings = true;
        } elseif ($section === 'schedule') {
          $schedule = $decoded;
          $hasSchedule = true;
        }
      }
    }

    $assets = [];
    $assetStmt = $pdo->query('SELECT rel, original_rel, name, mime, data FROM export_assets');
    if ($assetStmt !== false) {
      foreach ($assetStmt as $row) {
        $data = $row['data'] ?? null;
        if (!is_string($data) || $data === '') continue;
        $mime = is_string($row['mime'] ?? null) ? $row['mime'] : 'application/octet-stream';
        $name = is_string($row['name'] ?? null) ? $row['name'] : null;
        $originalRel = normalize_asset_rel($row['original_rel'] ?? $row['rel'] ?? '');
        $aliases = [];
        if (is_string($row['rel'] ?? null)) {
          $aliases[] = $row['rel'];
        }
        if (is_string($row['original_rel'] ?? null) && $row['original_rel'] !== ($row['rel'] ?? null)) {
          $aliases[] = $row['original_rel'];
        }
        $assets[] = [
          'mime' => $mime,
          'name' => $name,
          'data' => $data,
          'originalRel' => $originalRel,
          'aliases' => $aliases,
        ];
      }
    }

    return [
      'settings' => $settings,
      'schedule' => $schedule,
      'hasSettings' => $hasSettings,
      'hasSchedule' => $hasSchedule,
      'assets' => $assets,
    ];
  } catch (Throwable $exception) {
    error_log('import: sqlite export read failed: ' . $exception->getMessage());
    throw new ImportException('sqlite-read-failed', 400, $exception->getMessage());
  }
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
$inputPath = '';
if (!empty($_FILES['file']['tmp_name'])) {
  $inputPath = (string) $_FILES['file']['tmp_name'];
  $raw = file_get_contents($inputPath);
} else {
  $raw = file_get_contents('php://input');
}
if ($raw === '' || $raw === false) fail('no-data');

$payload = null;
if (import_is_sqlite($raw)) {
  if ($inputPath === '') {
    $temp = tempnam(sys_get_temp_dir(), 'signage_import_');
    if ($temp === false) {
      fail('tempfile-unavailable', 500);
    }
    $bytes = file_put_contents($temp, $raw);
    if ($bytes === false) {
      @unlink($temp);
      fail('tempfile-unavailable', 500);
    }
    $inputPath = $temp;
  }
  try {
    $payload = import_parse_sqlite($inputPath);
  } catch (ImportException $exception) {
    if (isset($temp) && is_file($temp)) {
      @unlink($temp);
    }
    fail($exception->errorCode, $exception->statusCode);
  }
  if (isset($temp) && is_file($temp)) {
    @unlink($temp);
  }
} else {
  try {
    $payload = import_parse_json($raw);
  } catch (ImportException $exception) {
    fail($exception->errorCode, $exception->statusCode);
  }
}

$settings = $payload['settings'] ?? null;
$schedule = $payload['schedule'] ?? null;
$hasSettings = !empty($payload['hasSettings']);
$hasSchedule = !empty($payload['hasSchedule']);
$assetsList = is_array($payload['assets'] ?? null) ? $payload['assets'] : [];
if (!$hasSettings && !$hasSchedule) fail('missing-sections');

$writeAssets   = !empty($_POST['writeAssets']) || !empty($_GET['writeAssets']);
$writeSettings = isset($_POST['writeSettings']) ? ($_POST['writeSettings']==='1') : true;
$writeSchedule = isset($_POST['writeSchedule']) ? ($_POST['writeSchedule']==='1') : true;

@mkdir(signage_assets_path('img'), 02775, true);
@mkdir(signage_assets_path('media'), 02775, true);

function ensure_asset_directory(string $relDir): ?string {
  $absolute = signage_absolute_path($relDir);
  if (!is_dir($absolute) && !@mkdir($absolute, 02775, true) && !is_dir($absolute)) {
    return null;
  }
  return $absolute;
}

$pathMap = []; // original rel path => new rel path
if ($writeAssets && !empty($assetsList)) {
  $i = 0;
  foreach ($assetsList as $asset) {
    $mime = is_string($asset['mime'] ?? null) ? $asset['mime'] : 'application/octet-stream';
    $data = $asset['data'] ?? null;
    if (!is_string($data) || $data === '') continue;
    $originalRel = normalize_asset_rel($asset['originalRel'] ?? null);
    $baseName = pathinfo($originalRel ?: ($asset['name'] ?? ''), PATHINFO_FILENAME);
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
    $res = file_put_contents($outAbs, $data);
    if ($res === false) {
      $err = error_get_last();
      error_log("file_put_contents failed for $outAbs: ".($err['message'] ?? 'unknown error'));
      continue;
    }
    @chmod($outAbs, 0644);
    $aliases = [];
    if (is_array($asset['aliases'] ?? null)) {
      $aliases = $asset['aliases'];
    }
    if ($originalRel) {
      $aliases[] = $originalRel;
    }
    $aliases = array_unique(array_filter(array_map(function ($alias) {
      return normalize_asset_rel($alias) ?? (is_string($alias) ? trim($alias) : null);
    }, $aliases)));
    if (empty($aliases)) {
      $aliases[] = $outRel;
    }
    foreach ($aliases as $alias) {
      if ($alias === null || $alias === '') continue;
      $pathMap[$alias] = $outRel;
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
