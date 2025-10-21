<?php
require_once __DIR__ . '/auth/guard.php';
require_once __DIR__ . '/storage.php';

auth_require_permission('media');

// Zweck: Sicheren Upload von Medien nach /assets/media/ (Bilder, Videos)
// Hinweise: Nginx client_max_body_size & PHP upload_max_filesize/post_max_size müssen groß genug sein.

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store');

$isHttps = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
    || (isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443');
if (!$isHttps) {
  error_log('[signage] upload request received over non-HTTPS transport');
}

$fallbackThumb = '/assets/img/thumb_fallback.svg';

function fail($msg, $code=400, $detail=null){
  http_response_code($code);
  $resp = ['ok'=>false,'error'=>$msg];
  if ($detail) $resp['errorDetail'] = $detail;
  echo json_encode($resp);
  exit;
}

if ($_SERVER['REQUEST_METHOD']!=='POST') fail('method');

$maxBytes = 256*1024*1024; // 256MB
$contentLength = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : null;
if ($contentLength !== null && $contentLength > $maxBytes) {
  fail('too-large (declared)', 413);
}

if (!isset($_FILES['file'])) fail('nofile');

$u = $_FILES['file'];
if (!empty($u['error'])) fail('upload-error-'.$u['error']);
if (!is_uploaded_file($u['tmp_name'])) fail('tmp-missing');

// Limits (kann via PHP-INI/Nginx größer sein)
$fileSize = filesize($u['tmp_name']);
if ($fileSize > $maxBytes) fail('too-large (server limit)');

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($u['tmp_name']) ?: 'application/octet-stream';
$allowed = [
  'image/png'        => ['ext'=>'png',  'dir'=>'img'],
  'image/jpeg'       => ['ext'=>'jpg',  'dir'=>'img'],
  'image/webp'       => ['ext'=>'webp', 'dir'=>'img'],
  'image/svg+xml'    => ['ext'=>'svg',  'dir'=>'img'],
  'video/mp4'        => ['ext'=>'mp4',  'dir'=>'video']
];
if (!isset($allowed[$mime])) fail('unsupported-type: '.$mime);

$ext = $allowed[$mime]['ext'];
$subDir = $allowed[$mime]['dir'];

$orig = preg_replace('/[^A-Za-z0-9._-]/','_', $u['name']);
if (!$orig) $orig = 'upload.' . $ext;
if (!preg_match('/\\.' . preg_quote($ext,'/') . '$/i', $orig)) $orig .= '.' . $ext;

$baseDir = rtrim(signage_assets_path('media/'.$subDir), '/') . '/';
if (!is_dir($baseDir)) { @mkdir($baseDir, 02775, true); @chown($baseDir,'www-data'); @chgrp($baseDir,'www-data'); }

$dest = $baseDir . $orig;
$pi = pathinfo($dest);
$fname = $pi['filename']; $i=0;
while (file_exists($dest)) { $i++; $dest = $pi['dirname'].'/'.$fname.'_'.$i.'.'.$ext; }

$free = @disk_free_space($baseDir);
if ($free !== false && $free < $fileSize) {
  $detail = 'free='.$free.' need='.$fileSize;
  fail('disk-full', 507, $detail);
}

if (!@move_uploaded_file($u['tmp_name'], $dest)) fail('move-failed', 500);
@chmod($dest, 0644); @chown($dest,'www-data'); @chgrp($dest,'www-data');

$publicPath = '/assets/media/'.$subDir.'/' . basename($dest);
// optional preview image (thumb)
$thumbPath = null;
if ($subDir === 'img'){
  $thumbPath = $publicPath;
} elseif (isset($_FILES['thumb']) && is_uploaded_file($_FILES['thumb']['tmp_name'])) {
  $tu = $_FILES['thumb'];
  if (!empty($tu['error'])) fail('thumb-upload-error-'.$tu['error']);
  $tmime = $finfo->file($tu['tmp_name']) ?: 'application/octet-stream';
  $allowedThumb = [
    'image/png'     => 'png',
    'image/jpeg'    => 'jpg',
    'image/webp'    => 'webp',
    'image/svg+xml' => 'svg',
  ];
  if (!isset($allowedThumb[$tmime])) fail('thumb-unsupported-type: '.$tmime);
  $text = $allowedThumb[$tmime];
  $torig = preg_replace('/[^A-Za-z0-9._-]/','_', $tu['name']);
  if (!$torig) $torig = 'thumb.'.$text;
  if (!preg_match('/\\.' . preg_quote($text,'/') . '$/i', $torig)) $torig .= '.' . $text;
  $tbase = rtrim(signage_assets_path('media/img'), '/') . '/';
  if (!is_dir($tbase)) { @mkdir($tbase, 02775, true); @chown($tbase,'www-data'); @chgrp($tbase,'www-data'); }
  $tdest = $tbase . $torig;
  $tpi = pathinfo($tdest);
  $tfname = $tpi['filename']; $ti=0;
  while (file_exists($tdest)) { $ti++; $tdest = $tpi['dirname'].'/'.$tfname.'_'.$ti.'.'.$text; }
  if (!@move_uploaded_file($tu['tmp_name'], $tdest)) fail('thumb-move-failed', 500);
  @chmod($tdest, 0644); @chown($tdest,'www-data'); @chgrp($tdest,'www-data');
  $thumbPath = '/assets/media/img/' . basename($tdest);
}

// final fallback to generic icon
if (!$thumbPath){
  $thumbPath = $fallbackThumb;
}

echo json_encode(['ok'=>true,'path'=>$publicPath,'thumb'=>$thumbPath]);
