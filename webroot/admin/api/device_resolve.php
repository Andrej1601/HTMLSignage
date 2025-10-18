<?php
require_once __DIR__ . '/storage.php';
require_once __DIR__ . '/devices_store.php';
require_once __DIR__ . '/device_resolver.php';

/**
 * File: /var/www/signage/admin/api/device_resolve.php
 * Zweck: Liefert aufgelöste Einstellungen (global + Geräte-Overrides) und Zeitplan.
 * Warum wichtige Checks: Verhindert "undefined"-Geräte & sorgt für robuste Fallbacks.
 */

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$rawDevice = $_GET['device'] ?? '';
$rawDevice = is_string($rawDevice) ? trim($rawDevice) : '';

if ($rawDevice === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'missing-device'], JSON_UNESCAPED_SLASHES);
    exit;
}

$error = null;
$payload = devices_resolve_payload($rawDevice, $error);

if ($payload === null) {
    $status = $error['status'] ?? 500;
    $code = $error['code'] ?? 'resolve-failed';
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $code], JSON_UNESCAPED_SLASHES);
    exit;
}

$out = [
    'ok' => true,
    'device' => $payload['device'],
    'settings' => $payload['settings'],
    'schedule' => $payload['schedule'],
    'meta' => $payload['meta'] ?? [],
    'now' => time(),
];

echo json_encode($out, SIGNAGE_JSON_FLAGS);
