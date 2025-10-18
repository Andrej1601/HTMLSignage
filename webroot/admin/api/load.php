<?php
require_once __DIR__ . '/storage.php';

header('Content-Type: application/json; charset=UTF-8');

$schedule = signage_read_json('schedule.json', signage_default_schedule());
$schedule = signage_normalize_schedule($schedule);

echo json_encode($schedule, SIGNAGE_JSON_FLAGS);
