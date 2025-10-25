<?php
require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/storage.php';

const SIGNAGE_SAVE_MAX_BYTES = 2 * 1024 * 1024; // 2 MiB

$user = auth_require_permission('module-slideshow');
$canWriteSettings = auth_user_has_permission($user, 'module-system');

header('Content-Type: application/json; charset=UTF-8');

function signage_save_respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, SIGNAGE_JSON_RESPONSE_FLAGS);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    signage_save_respond(405, ['ok' => false, 'error' => 'method-not-allowed']);
}

$contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : null;
if ($contentLength !== null && $contentLength > SIGNAGE_SAVE_MAX_BYTES) {
    signage_save_respond(413, ['ok' => false, 'error' => 'body-too-large']);
}

$raw = file_get_contents('php://input');
if ($raw === '' || $raw === false) {
    signage_save_respond(400, ['ok' => false, 'error' => 'empty']);
}

if (strlen($raw) > SIGNAGE_SAVE_MAX_BYTES) {
    signage_save_respond(413, ['ok' => false, 'error' => 'body-too-large']);
}

$data = json_decode($raw, true);
if (!is_array($data)) {
    signage_save_respond(400, ['ok' => false, 'error' => 'bad-json', 'detail' => json_last_error_msg()]);
}

if (!array_key_exists('schedule', $data) || !array_key_exists('settings', $data)) {
    signage_save_respond(400, ['ok' => false, 'error' => 'missing-fields']);
}

$scheduleError = null;
if (!signage_validate_schedule_payload($data['schedule'], $scheduleError)) {
    signage_save_respond(422, ['ok' => false, 'error' => 'invalid-schedule', 'detail' => $scheduleError]);
}

$settingsError = null;
if (!signage_validate_settings_payload($data['settings'], $settingsError)) {
    signage_save_respond(422, ['ok' => false, 'error' => 'invalid-settings', 'detail' => $settingsError]);
}

$scheduleStatus = null;
$settingsStatus = null;

$scheduleOk = signage_write_json('schedule.json', $data['schedule'], $scheduleError, $scheduleStatus);
$settingsOk = true;

if ($canWriteSettings) {
    $settingsOk = signage_write_json('settings.json', $data['settings'], $settingsError, $settingsStatus);
}

if (!$scheduleOk || !$settingsOk) {
    if ($scheduleError) {
        error_log('[signage] save schedule failed: ' . $scheduleError);
    }
    if ($settingsError) {
        error_log('[signage] save settings failed: ' . $settingsError);
    }
    signage_save_respond(500, [
        'ok' => false,
        'error' => 'write-failed',
        'scheduleStorage' => $scheduleStatus,
        'settingsStorage' => $settingsStatus,
    ]);
}

signage_save_respond(200, [
    'ok' => true,
    'settingsWritten' => $canWriteSettings,
    'scheduleStorage' => $scheduleStatus,
    'settingsStorage' => $canWriteSettings ? $settingsStatus : null,
]);
