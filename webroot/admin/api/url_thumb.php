<?php
header('Content-Type: application/json; charset=UTF-8');

$fallback = '/assets/img/thumb_fallback.svg';
$errorDetail = null;

$raw = file_get_contents('php://input');
$req = json_decode($raw, true);
$url = $req['url'] ?? '';
$parts = parse_url($url);
$host = $parts['host'] ?? '';
if (!$host) {
  $errorDetail = 'missing host';
  error_log('url_thumb: invalid-url '.$url);
  echo json_encode(['ok'=>true,'thumb'=>$fallback,'thumbFallback'=>true,'error'=>'invalid-url','errorDetail'=>$errorDetail]);
  exit;
}

$curlInfo = null;
$curlErrno = null;
$curlStep = 'page';
$imgUrl = null;

try {
  if (!function_exists('curl_init')) {
    $errorDetail = 'curl extension not loaded';
    throw new Exception('curl-missing');
  }

  // --- Fetch HTML page ----------------------------------------------------
  $ch = curl_init($url);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 5,
    CURLOPT_USERAGENT => 'Mozilla/5.0'
  ]);
  $html = curl_exec($ch);
  $curlErrno = curl_errno($ch);
  $curlInfo = curl_getinfo($ch);
  $code = $curlInfo['http_code'] ?? 0;
  if ($html === false || $curlErrno !== 0 || $code >= 400) {
    $err = curl_error($ch);
    $errorDetail = $err ?: ('HTTP '.$code);
    curl_close($ch);
    throw new Exception($err ?: 'page-download-failed');
  }
  curl_close($ch);

  // --- Parse og:image / link rel=icon ------------------------------------
  libxml_use_internal_errors(true);
  $doc = new DOMDocument();
  @$doc->loadHTML($html);
  libxml_clear_errors();
  $xp = new DOMXPath($doc);
  $node = $xp->query("//meta[@property='og:image' or @name='og:image']/@content")->item(0);
  if ($node) $imgUrl = trim($node->nodeValue);
  if (!$imgUrl) {
    $node = $xp->query("//link[contains(translate(@rel,'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'icon')]/@href")->item(0);
    if ($node) $imgUrl = trim($node->nodeValue);
  }

  // --- Fallback to host favicon ------------------------------------------
  if (!$imgUrl) {
    $imgUrl = 'https://'.$host.'/favicon.ico';
  } else {
    // make URL absolute if needed
    if (!preg_match('#^https?://#i', $imgUrl)) {
      $scheme = $parts['scheme'] ?? 'https';
      if (strpos($imgUrl, '//') === 0) {
        $imgUrl = $scheme.':'.$imgUrl;
      } elseif (substr($imgUrl,0,1) === '/') {
        $imgUrl = $scheme.'://'.$host.$imgUrl;
      } else {
        $basePath = isset($parts['path']) ? rtrim(dirname($parts['path']), '/') : '';
        $imgUrl = $scheme.'://'.$host.$basePath.'/'.$imgUrl;
      }
    }
  }

  // --- Download image -----------------------------------------------------
  $curlStep = 'image';
  $ch = curl_init($imgUrl);
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_TIMEOUT => 5,
    CURLOPT_USERAGENT => 'Mozilla/5.0'
  ]);
  $imgData = curl_exec($ch);
  $curlErrno = curl_errno($ch);
  $curlInfo = curl_getinfo($ch);
  $code = $curlInfo['http_code'] ?? 0;
  if ($imgData === false || $curlErrno !== 0 || $code >= 400) {
    $err = curl_error($ch);
    $errorDetail = $err ?: ('HTTP '.$code);
    curl_close($ch);
    throw new Exception($err ?: 'download-failed');
  }
  curl_close($ch);

  if (!function_exists('imagecreatefromstring')) {
    $errorDetail = 'gd extension not loaded';
    throw new Exception('gd-missing');
  }

  $im = @imagecreatefromstring($imgData);
  if (!$im) {
    $errorDetail = 'invalid image data';
    throw new Exception('invalid-image');
  }

  $dir = '/var/www/signage/assets/media/img/';
  if (!is_dir($dir)) { @mkdir($dir, 02775, true); @chown($dir,'www-data'); @chgrp($dir,'www-data'); }
  $fname = 'preview_'.bin2hex(random_bytes(5)).'.jpg';
  $full = $dir.$fname;
  if (!imagejpeg($im, $full, 90)) {
    $errorDetail = 'imagejpeg failed';
    imagedestroy($im);
    throw new Exception('save-failed');
  }
  imagedestroy($im);
  @chmod($full,0644); @chown($full,'www-data'); @chgrp($full,'www-data');
  $public = '/assets/media/img/'.$fname;
  echo json_encode(['ok'=>true,'thumb'=>$public]);
  exit;
} catch (Exception $e) {
  error_log(json_encode([
    'event'=>'url_thumb-error',
    'url'=>$url,
    'step'=>$curlStep,
    'error'=>$e->getMessage(),
    'detail'=>$errorDetail,
    'curl_errno'=>$curlErrno,
    'curl_info'=>$curlInfo
  ]));
  echo json_encode([
    'ok'=>true,
    'thumb'=>$fallback,
    'thumbFallback'=>true,
    'error'=>$e->getMessage(),
    'errorDetail'=>$errorDetail
  ]);
  exit;
}

