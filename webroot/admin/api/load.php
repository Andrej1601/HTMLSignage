<?php
/**
 * Legacy Endpoint: Load Schedule
 * Proxies to new API v1 but returns old format
 */
declare(strict_types=1);

require_once __DIR__ . '/storage.php';

// For now, use old implementation
// TODO: Migrate frontend to use /admin/api/v1/schedule directly
header('Content-Type: application/json; charset=UTF-8');

$schedule = signage_schedule_load();

echo json_encode($schedule, SIGNAGE_JSON_RESPONSE_FLAGS);
