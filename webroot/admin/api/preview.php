<?php
// /admin/api/preview.php
// Erzeugt Screenshots für HTML- oder URL-Slides mittels Headless-Browser

header('Content-Type: application/json; charset=UTF-8');

function fail($msg,$code=400){ http_response_code($code); echo json_encode(['ok'=>false,'error'=>$msg]); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail('method');
$input = json_decode(file_get_contents('php://input'), true);
if (!is_array($input)) fail('json');
$type = $input['type'] ?? '';
$src = '';
$tmpFile = '';
if ($type === 'url'){
  $src = $input['url'] ?? '';
} elseif ($type === 'html'){
  $html = $input['html'] ?? '';
  $tmpFile = tempnam(sys_get_temp_dir(), 'htmlprev');
  file_put_contents($tmpFile, $html);
  $src = 'file://'.$tmpFile;
} else {
  fail('type');
}
if (!$src) fail('src');

$baseDir = '/var/www/signage/assets/media/img/';
if (!is_dir($baseDir)) { @mkdir($baseDir, 02775, true); @chown($baseDir,'www-data'); @chgrp($baseDir,'www-data'); }
$dest = $baseDir . 'preview_'.time().'_'.rand(1000,9999).'.jpg';
$cmd = 'google-chrome --headless --disable-gpu --window-size=800,450 --screenshot='.
  escapeshellarg($dest).' '.escapeshellarg($src).' 2>&1';
@exec($cmd, $o, $ret);
if ($tmpFile) @unlink($tmpFile);
if ($ret !== 0 || !file_exists($dest)) fail('preview');
@chmod($dest,0644); @chown($dest,'www-data'); @chgrp($dest,'www-data');
$public = '/assets/media/img/'.basename($dest);
echo json_encode(['ok'=>true,'path'=>$public,'thumb'=>$public]);
