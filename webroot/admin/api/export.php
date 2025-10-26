<?php
require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/storage.php';

auth_require_permission('module-system');

function export_fail(int $status, array $payload): void
{
  http_response_code($status);
  header('Content-Type: application/json; charset=UTF-8');
  echo json_encode($payload, SIGNAGE_JSON_RESPONSE_FLAGS);
  exit;
}

function export_sqlite_available(): bool
{
  if (!class_exists('\\PDO')) {
    return false;
  }
  try {
    $drivers = \PDO::getAvailableDrivers();
  } catch (Throwable $exception) {
    error_log('PDO drivers unavailable for export: ' . $exception->getMessage());
    return false;
  }
  if (!in_array('sqlite', $drivers, true)) {
    return false;
  }
  if (!extension_loaded('pdo_sqlite') && !extension_loaded('sqlite3')) {
    return false;
  }
  return true;
}

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

function classify_asset_type(string $mime, ?string $rel = null): string
{
  $normalizedMime = strtolower(trim($mime));
  if ($normalizedMime === '') {
    $normalizedMime = 'application/octet-stream';
  }
  if (str_starts_with($normalizedMime, 'image/')) {
    return 'image';
  }
  if (str_starts_with($normalizedMime, 'video/')) {
    return 'video';
  }
  if (str_starts_with($normalizedMime, 'audio/')) {
    return 'audio';
  }

  $extension = strtolower((string) pathinfo((string) $rel, PATHINFO_EXTENSION));
  if (in_array($extension, ['png','jpg','jpeg','gif','webp','svg','avif'], true)) {
    return 'image';
  }
  if (in_array($extension, ['mp4','m4v','webm','ogv','mov','avi','mkv'], true)) {
    return 'video';
  }
  if (in_array($extension, ['mp3','ogg','oga','wav','aac','flac','m4a'], true)) {
    return 'audio';
  }

  return 'document';
}

$legacyInclude = get_flag('include', 0);  // Unterstützung für ältere Clients
$incImages     = get_flag('includeImages', $legacyInclude);
$incVideos     = get_flag('includeVideos', $legacyInclude);
$incAudio      = get_flag('includeAudio', $legacyInclude);
$incDocuments  = get_flag('includeDocuments', $legacyInclude);
$incSettings   = get_flag('settings', 1);
$incSchedule   = get_flag('schedule', 1);
$includeAny    = ($incImages || $incVideos || $incAudio || $incDocuments);

if (!export_sqlite_available()) {
  export_fail(500, ['ok' => false, 'error' => 'sqlite-unavailable']);
}

$settings = ($incSettings || $includeAny) ? signage_read_json('settings.json') : null;
$schedule = ($incSchedule || $includeAny) ? signage_read_json('schedule.json') : null;

$assetEntries = [];

if ($includeAny) {
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
    $fi = new finfo(FILEINFO_MIME_TYPE);
    foreach (array_keys($pathSet) as $rel) {
      if (!is_string($rel) || !str_starts_with($rel, '/assets/')) continue;
      $abs = signage_absolute_path($rel);
      if (!is_file($abs)) continue;
      $mime = $fi->file($abs) ?: 'application/octet-stream';
      $type = classify_asset_type($mime, $rel);
      if ($type === 'image' && !$incImages) continue;
      if ($type === 'video' && !$incVideos) continue;
      if ($type === 'audio' && !$incAudio) continue;
      if ($type === 'document' && !$incDocuments) continue;
      $data = @file_get_contents($abs);
      if ($data === false) continue;
      $assetEntries[] = [
        'rel' => $rel,
        'original_rel' => $rel,
        'name' => basename($abs),
        'mime' => $mime,
        'data' => $data,
      ];
    }
  }
}

$tmpPath = tempnam(sys_get_temp_dir(), 'signage_export_');
if ($tmpPath === false) {
  export_fail(500, ['ok' => false, 'error' => 'tempfile-unavailable']);
}

try {
  $pdo = new \PDO('sqlite:' . $tmpPath, null, null, [
    \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
    \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
    \PDO::ATTR_EMULATE_PREPARES => false,
  ]);
  $pdo->exec('PRAGMA journal_mode = OFF');
  $pdo->exec('PRAGMA synchronous = OFF');
  $pdo->exec('PRAGMA foreign_keys = OFF');
  $pdo->exec('CREATE TABLE export_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )');
  $pdo->exec('CREATE TABLE export_state (
    section TEXT PRIMARY KEY,
    json TEXT NOT NULL
  )');
  $pdo->exec('CREATE TABLE export_assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rel TEXT,
    original_rel TEXT,
    name TEXT,
    mime TEXT NOT NULL,
    data BLOB NOT NULL
  )');

  $metaStmt = $pdo->prepare('INSERT INTO export_meta(key, value) VALUES (:key, :value)');
  $meta = [
    'kind' => 'signage-export',
    'version' => '2',
    'exportedAt' => gmdate('c'),
    'includeImages' => $incImages ? '1' : '0',
    'includeVideos' => $incVideos ? '1' : '0',
    'includeAudio' => $incAudio ? '1' : '0',
    'includeDocuments' => $incDocuments ? '1' : '0',
    'includesSettings' => $incSettings ? '1' : '0',
    'includesSchedule' => $incSchedule ? '1' : '0',
  ];
  foreach ($meta as $key => $value) {
    $metaStmt->execute([':key' => $key, ':value' => (string) $value]);
  }

  if ($incSettings && is_array($settings)) {
    $json = json_encode($settings, SIGNAGE_JSON_STORAGE_FLAGS);
    if ($json !== false) {
      $stateStmt = $pdo->prepare('INSERT INTO export_state(section, json) VALUES (:section, :json)');
      $stateStmt->execute([':section' => 'settings', ':json' => $json]);
    }
  }
  if ($incSchedule && is_array($schedule)) {
    $json = json_encode($schedule, SIGNAGE_JSON_STORAGE_FLAGS);
    if ($json !== false) {
      $stateStmt = $pdo->prepare('INSERT INTO export_state(section, json) VALUES (:section, :json)');
      $stateStmt->execute([':section' => 'schedule', ':json' => $json]);
    }
  }

  if (!empty($assetEntries)) {
    $assetStmt = $pdo->prepare('INSERT INTO export_assets(rel, original_rel, name, mime, data) VALUES (:rel, :original_rel, :name, :mime, :data)');
    foreach ($assetEntries as $asset) {
      $assetStmt->bindValue(':rel', $asset['rel']);
      $assetStmt->bindValue(':original_rel', $asset['original_rel']);
      $assetStmt->bindValue(':name', $asset['name']);
      $assetStmt->bindValue(':mime', $asset['mime']);
      $assetStmt->bindValue(':data', $asset['data'], \PDO::PARAM_LOB);
      $assetStmt->execute();
    }
  }
} catch (Throwable $exception) {
  @unlink($tmpPath);
  export_fail(500, ['ok' => false, 'error' => 'sqlite-export-failed', 'message' => $exception->getMessage()]);
}

$name = isset($_GET['name']) ? preg_replace('/[^A-Za-z0-9_.-]/','_', $_GET['name']) : ('signage_export_'.date('Ymd'));
$suffixParts = [];
if ($incImages) $suffixParts[] = 'img';
if ($incVideos) $suffixParts[] = 'vid';
if ($incAudio) $suffixParts[] = 'aud';
if ($incDocuments) $suffixParts[] = 'files';
$fileName = $name . (!empty($suffixParts) ? '_with-' . implode('-', $suffixParts) : '') . '.sqlite';
header('Content-Type: application/x-sqlite3');
header('Content-Disposition: attachment; filename="' . $fileName . '"');
header('X-Content-Type-Options: nosniff');
$size = @filesize($tmpPath);
if ($size !== false) {
  header('Content-Length: ' . $size);
}
readfile($tmpPath);
@unlink($tmpPath);
exit;
