<?php
header('Content-Type: application/json; charset=UTF-8');

function hasCommand($cmd){
  if (!function_exists('shell_exec')) return false;
  $out = @shell_exec('command -v '.escapeshellarg($cmd).' 2>&1');
  return trim((string)$out) !== '';
}

$resp = [
  'ffmpeg' => ['cli' => hasCommand('ffmpeg')],
  'curl'   => ['cli' => hasCommand('curl'), 'extension' => extension_loaded('curl')],
  'gd'     => ['extension' => extension_loaded('gd')]
];

echo json_encode($resp);
