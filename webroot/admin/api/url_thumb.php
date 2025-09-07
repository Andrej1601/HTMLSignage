<?php
header('Content-Type: application/json; charset=UTF-8');
$fallback = '/assets/img/thumb_fallback.svg';

$raw = file_get_contents('php://input');
$req = json_decode($raw, true);
$url = $req['url'] ?? '';
if (!is_string($url) || !preg_match('#^https?://#i', $url)) {
  echo json_encode(['ok'=>false,'thumb'=>$fallback]);
  exit;
}

if (!extension_loaded('curl')) {
  error_log('url_thumb: curl extension not loaded');
  echo json_encode(['ok'=>false,'thumb'=>$fallback]);
  exit;
}
if (!extension_loaded('gd')) {
  error_log('url_thumb: gd extension not loaded');
  echo json_encode(['ok'=>false,'thumb'=>$fallback]);
  exit;
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
  error_log('url_thumb html curl error: '.curl_error($ch));
  curl_close($ch);
  echo json_encode(['ok'=>false,'thumb'=>$fallback]);
  exit;
}
$baseUrl = curl_getinfo($ch, CURLINFO_EFFECTIVE_URL) ?: $url;
curl_close($ch);

$imgUrl = '';
if (preg_match('/<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']/i', $html, $m)) {
  $imgUrl = $m[1];
} elseif (preg_match('/<link\s+[^>]*rel=["\'](?:shortcut )?icon["\'][^>]*href=["\']([^"\']+)["\']/i', $html, $m)) {
  $imgUrl = $m[1];
}
if (!$imgUrl) {
  error_log('url_thumb: no image found at '.$url);
  echo json_encode(['ok'=>false,'thumb'=>$fallback]);
  exit;
}
$imgUrl = html_entity_decode($imgUrl, ENT_QUOTES|ENT_HTML5, 'UTF-8');
$base = parse_url($baseUrl);
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
  error_log('url_thumb image curl error: '.curl_error($ch));
  curl_close($ch);
  echo json_encode(['ok'=>false,'thumb'=>$fallback]);
  exit;
}
curl_close($ch);

$im = @imagecreatefromstring($imgData);
if (!$im) {
  error_log('url_thumb: invalid image data');
  echo json_encode(['ok'=>false,'thumb'=>$fallback]);
  exit;
}
$dir = '/var/www/signage/assets/media/img/';
if (!is_dir($dir)) { @mkdir($dir, 02775, true); @chown($dir,'www-data'); @chgrp($dir,'www-data'); }
$fname = 'preview_'.bin2hex(random_bytes(5)).'.jpg';
$full = $dir.$fname;
if (!imagejpeg($im, $full, 90)) {
  error_log('url_thumb: failed to save image to '.$full);
  imagedestroy($im);
  echo json_encode(['ok'=>false,'thumb'=>$fallback]);
  exit;
}
imagedestroy($im);
@chmod($full,0644); @chown($full,'www-data'); @chgrp($full,'www-data');
$public = '/assets/media/img/'.$fname;

echo json_encode(['ok'=>true,'thumb'=>$public]);
