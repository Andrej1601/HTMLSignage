<?php
/**
 * File: /var/www/signage/admin/api/device_resolve.php
 * Zweck: Liefert aufgelöste Einstellungen (global + Geräte-Overrides) und Zeitplan.
 * Warum wichtige Checks: Verhindert "undefined"-Geräte & sorgt für robuste Fallbacks.
 */

require_once __DIR__ . '/devices_lib.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

// --- kleine Helfer (nur "warum"-kritische Funktionalität) -------------------

/** Rekursives Merge nur für assoziative Arrays; Geräte-Overrides haben Vorrang. */
function merge_r($a, $b) {
  if (!is_array($a)) $a = [];
  if (!is_array($b)) return $a;
  foreach ($b as $k => $v) {
    $a[$k] = (is_array($v) && array_key_exists($k, $a) && is_array($a[$k]))
      ? merge_r($a[$k], $v)
      : $v;
  }
  return $a;
}

/** JSON sicher lesen; bei defekten/fehlenden Dateien leere Defaults liefern. */
function read_json_file($absPath) {
  if (!is_file($absPath)) return [];
  $raw = @file_get_contents($absPath);
  $j = json_decode($raw, true);
  return is_array($j) ? $j : [];
}

/** Aktueller Tag als Kurzschlüssel (Sun,Mon,...). */
function day_key() {
  return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][intval(date('w'))] ?? 'Sun';
}

// --- Input ------------------------------------------------------------------

$devId = isset($_GET['device']) ? trim($_GET['device']) : '';
if ($devId === '') {
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'missing-device'], JSON_UNESCAPED_SLASHES);
  exit;
}
if (!preg_match('/^dev_[a-f0-9]{12}$/i', $devId)) {
  // Schützt vor Karteileichen/Fehlformaten
  http_response_code(400);
  echo json_encode(['ok'=>false, 'error'=>'invalid-device-format'], JSON_UNESCAPED_SLASHES);
  exit;
}

// --- DB & Gerät -------------------------------------------------------------

$db  = devices_load();
$dev = $db['devices'][$devId] ?? null;
if (!$dev) {
  http_response_code(404);
  echo json_encode(['ok'=>false, 'error'=>'device-not-found'], JSON_UNESCAPED_SLASHES);
  exit;
}

// --- Pfade & Basiskonfiguration --------------------------------------------

$docRoot = rtrim($_SERVER['DOCUMENT_ROOT'] ?? '', '/');
if ($docRoot === '' || !is_dir($docRoot)) {
  // Fallback, falls PHP-FPM nicht mit korrektem DOCUMENT_ROOT läuft
  $docRoot = rtrim(realpath(__DIR__ . '/../../'), '/');
}

$baseSettings = read_json_file($docRoot . '/data/settings.json');
$baseSchedule = read_json_file($docRoot . '/data/schedule.json');
$baseScheduleVersion = intval($baseSchedule['version'] ?? 0);

$overSettings = $dev['overrides']['settings'] ?? [];
$overSchedule = $dev['overrides']['schedule'] ?? [];

if (empty($dev['useOverrides'])) {
  $overSettings = [];
  $overSchedule = [];
} else {
  if (!is_array($overSettings)) $overSettings = [];
  if (!is_array($overSchedule)) $overSchedule = [];
}


// --- Merge & Versionen ------------------------------------------------------

$mergedSettings = merge_r($baseSettings, $overSettings);

// Preset-Felder aus Basiskonfig übernehmen, falls Overrides sie weglassen
if (!array_key_exists('presetAuto', $overSettings) || $overSettings['presetAuto'] === null || $overSettings['presetAuto'] === '') {
  if (array_key_exists('presetAuto', $baseSettings)) {
    $mergedSettings['presetAuto'] = $baseSettings['presetAuto'];
  }
}
if (!array_key_exists('presets', $overSettings) || !is_array($overSettings['presets']) || count($overSettings['presets']) === 0) {
  if (array_key_exists('presets', $baseSettings) && is_array($baseSettings['presets'])) {
    $mergedSettings['presets'] = $baseSettings['presets'];
  }
}

// Zeitplan ggf. anhand Preset automatisch ersetzen
$schedule = $baseSchedule;
if (!empty($mergedSettings['presetAuto']) && !empty($mergedSettings['presets']) && is_array($mergedSettings['presets'])) {
  $presets = $mergedSettings['presets'];
  $preset = $presets[day_key()] ?? ($presets['Default'] ?? null);
  if (is_array($preset) && isset($preset['saunas']) && isset($preset['rows']) && is_array($preset['rows'])) {
    $schedule = $preset;
  }
}

if ($dev['useOverrides'] && !empty($overSchedule)) {
  $schedule = merge_r($schedule, $overSchedule);
  $schedule['version'] = intval($overSchedule['version'] ?? 0);
} else {
  $schedule['version'] = $baseScheduleVersion;
}

// Version als einfache Cache-Bremse; nimmt höchste bekannte Version
$mergedSettings['version'] = max(
  intval($baseSettings['version'] ?? 0),
  intval($overSettings['version'] ?? 0)
);

// --- Antwort ----------------------------------------------------------------

$out = [
  'ok'       => true,
  'device'   => [
    'id'   => $devId,
    'name' => $dev['name'] ?? $devId,
  ],
  'settings' => $mergedSettings,
  'schedule' => $schedule,
  'now'      => time(),
];

echo json_encode($out, JSON_UNESCAPED_SLASHES);
