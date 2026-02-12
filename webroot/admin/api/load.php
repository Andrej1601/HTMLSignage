<?php
require_once __DIR__ . '/storage.php';

header('Content-Type: application/json; charset=UTF-8');

$schedule = signage_schedule_load();

echo json_encode($schedule, SIGNAGE_JSON_RESPONSE_FLAGS);
