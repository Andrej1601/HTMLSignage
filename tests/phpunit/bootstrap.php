<?php

declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '1');

date_default_timezone_set('UTC');

$root = dirname(__DIR__, 1);
$root = dirname($root);
putenv('SIGNAGE_BASE_PATH=' . $root);
$_ENV['SIGNAGE_BASE_PATH'] = $root;
