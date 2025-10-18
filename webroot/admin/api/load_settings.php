<?php
require_once __DIR__ . '/storage.php';

header('Content-Type: application/json; charset=UTF-8');
$settings = signage_settings_load();

echo json_encode($settings, SIGNAGE_JSON_FLAGS);
