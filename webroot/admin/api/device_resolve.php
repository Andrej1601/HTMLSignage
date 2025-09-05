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

$overSettings = $dev['overrides']['settings'] ?? [];

if (empty($dev['useOverrides'])) {
  $overSettings = [];
} elseif (!is_array($overSettings)) {
  $overSettings = [];
}


// --- Merge & Versionen ------------------------------------------------------

$mergedSettings = merge_r($baseSettings, $overSettings);

// Version als einfache Cache-Bremse; nimmt höchste bekannte Version
$mergedSettings['version'] = max(
  intval($baseSettings['version'] ?? 0),
  intval($overSettings['version'] ?? 0)
);
$baseSchedule['version'] = intval($baseSchedule['version'] ?? 0);

// --- Antwort ----------------------------------------------------------------

$out = [
  'ok'       => true,
  'device'   => [
    'id'   => $devId,
    'name' => $dev['name'] ?? $devId,
  ],
  'settings' => $mergedSettings,
  'schedule' => $baseSchedule,
  'now'      => time(),
];

echo json_encode($out, JSON_UNESCAPED_SLASHES);
