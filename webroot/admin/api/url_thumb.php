<?php
header('Content-Type: application/json; charset=UTF-8');
$fallback = '/assets/img/thumb_fallback.svg';

function fail($msg){
  global $fallback;
  error_log('url_thumb: '.$msg);
  echo json_encode(['ok'=>false,'thumb'=>$fallback,'thumbFallback'=>true,'error'=>$msg]);
  exit;
}

function default_thumb($msg){
  global $fallback;
  error_log('url_thumb: '.$msg);
  echo json_encode(['ok'=>true,'thumb'=>$fallback,'thumbFallback'=>true,'error'=>$msg]);
  exit;
}

$raw = file_get_contents('php://input');
$req = json_decode($raw, true);
$url = $req['url'] ?? '';
if (!is_string($url) || !preg_match('#^https?://#i', $url)) {
  fail('invalid-url');
}

if (!extension_loaded('curl')) {
  fail('curl extension not loaded; install php-curl');
}
if (!extension_loaded('gd')) {
  fail('gd extension not loaded; install php-gd');
}

$ch = curl_init($url);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_TIMEOUT => 5,
  CURLOPT_USERAGENT => 'Mozilla/5.0'
]);
$html = curl_exec($ch);
if ($html === false) {
  $err = curl_error($ch);
  curl_close($ch);
  default_thumb('html curl error: '.$err);
}
$baseUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL) ?: $url;
curl_close($ch);
$base = parse_url($baseUrl);

$imgUrl = '';
if (preg_match('/<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']/i', $html, $m)) {
  $imgUrl = $m[1];
} elseif (preg_match('/<link\s+[^>]*rel=["\'](?:shortcut )?icon["\'][^>]*href=["\']([^"\']+)["\']/i', $html, $m)) {
  $imgUrl = $m[1];
} elseif (!empty($base['host'])) {
  $imgUrl = 'https://'.$base['host'].'/favicon.ico';
} else {
  default_thumb('no image found');
}
$imgUrl = html_entity_decode($imgUrl, ENT_QUOTES|ENT_HTML5, 'UTF-8');
if (strpos($imgUrl, '//') === 0) {
  $imgUrl = $base['scheme'].':'.$imgUrl;
} elseif (strpos($imgUrl, '/') === 0) {
  $imgUrl = $base['scheme'].'://'.$base['host'].$imgUrl;
} elseif (!preg_match('#^https?://#i', $imgUrl)) {
  $path = isset($base['path']) ? preg_replace('#/[^/]*$#', '/', $base['path']) : '/';
  $imgUrl = $base['scheme'].'://'.$base['host'].$path.$imgUrl;
}

$ch = curl_init($imgUrl);
curl_setopt_array($ch, [
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_FOLLOWLOCATION => true,
  CURLOPT_TIMEOUT => 5,
  CURLOPT_USERAGENT => 'Mozilla/5.0'
]);
$imgData = curl_exec($ch);
if ($imgData === false) {
  $err = curl_error($ch);
  curl_close($ch);
  default_thumb('image curl error: '.$err);
}
curl_close($ch);

if (!function_exists('imagecreatefromstring')) {
  fail('gd-missing');
}

$im = @imagecreatefromstring($imgData);
if (!$im) {
  default_thumb('invalid image data');
}
$dir = '/var/www/signage/assets/media/img/';
if (!is_dir($dir)) { @mkdir($dir, 02775, true); @chown($dir,'www-data'); @chgrp($dir,'www-data'); }
$fname = 'preview_'.bin2hex(random_bytes(5)).'.jpg';
$full = $dir.$fname;
if (!imagejpeg($im, $full, 90)) {
  imagedestroy($im);
  default_thumb('failed to save image');
}
imagedestroy($im);
@chmod($full,0644); @chown($full,'www-data'); @chgrp($full,'www-data');
$public = '/assets/media/img/'.$fname;

echo json_encode(['ok'=>true,'thumb'=>$public]);
