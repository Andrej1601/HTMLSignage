<?php
header('Content-Type: application/json; charset=UTF-8');
$fallback = '/assets/img/thumb_fallback.svg';

$raw = file_get_contents('php://input');
$req = json_decode($raw, true);
$url = $req['url'] ?? '';
$parts = parse_url($url);
$host = $parts['host'] ?? '';
if (!$host) {
  error_log('url_thumb: invalid-url '.$url);
  echo json_encode(['ok'=>false,'thumb'=>$fallback,'thumbFallback'=>true,'error'=>'invalid-url']);
  exit;
}

$imgUrl = 'https://'.$host.'/favicon.ico';

try {
  if (!function_exists('curl_init')) throw new Exception('curl-missing');
  $ch = curl_init($imgUrl);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 5,
    CURLOPT_USERAGENT => 'Mozilla/5.0'
  ]);
  $imgData = curl_exec($ch);
  if ($imgData === false || curl_getinfo($ch, CURLINFO_HTTP_CODE) >= 400) {
    $err = curl_error($ch);
    curl_close($ch);
    throw new Exception($err ?: 'download-failed');
  }
  curl_close($ch);

  if (!function_exists('imagecreatefromstring')) throw new Exception('gd-missing');
  $im = @imagecreatefromstring($imgData);
  if (!$im) throw new Exception('invalid-image');

  $dir = '/var/www/signage/assets/media/img/';
  if (!is_dir($dir)) { @mkdir($dir, 02775, true); @chown($dir,'www-data'); @chgrp($dir,'www-data'); }
  $fname = 'preview_'.bin2hex(random_bytes(5)).'.jpg';
  $full = $dir.$fname;
  if (!imagejpeg($im, $full, 90)) {
    imagedestroy($im);
    throw new Exception('save-failed');
  }
  imagedestroy($im);
  @chmod($full,0644); @chown($full,'www-data'); @chgrp($full,'www-data');
  $public = '/assets/media/img/'.$fname;
  echo json_encode(['ok'=>true,'thumb'=>$public]);
  exit;
} catch (Exception $e) {
  error_log('url_thumb: '.$e->getMessage());
  echo json_encode(['ok'=>true,'thumb'=>$fallback,'thumbFallback'=>true,'error'=>$e->getMessage()]);
  exit;
}

