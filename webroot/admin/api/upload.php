<?php
// file: /var/www/signage/admin/api/upload.php
// Zweck: Sicheren Upload von Medien nach /assets/media/ (Bilder, Videos)
// Hinweise: Nginx client_max_body_size & PHP upload_max_filesize/post_max_size müssen groß genug sein.

header('Content-Type: application/json; charset=UTF-8');

$fallbackThumb = '/assets/img/thumb_fallback.svg';

function fail($msg, $code=400, $detail=null){
  http_response_code($code);
  $resp = ['ok'=>false,'error'=>$msg];
  if ($detail) $resp['errorDetail'] = $detail;
  echo json_encode($resp);
  exit;
}

function makeVideoThumb($src, $fallback){
  $tbase = '/var/www/signage/assets/media/img/';
  if (!is_dir($tbase)) { @mkdir($tbase, 02775, true); @chown($tbase,'www-data'); @chgrp($tbase,'www-data'); }
  $pi = pathinfo($src);
  $thumbDest = $tbase . $pi['filename'] . '.jpg';
  $tpi = pathinfo($thumbDest); $tfname = $tpi['filename']; $ti = 0;
  while (file_exists($thumbDest)) { $ti++; $thumbDest = $tpi['dirname'].'/'.$tfname.'_'.$ti.'.jpg'; }

  $o = []; $ret = 0;
  exec('command -v ffmpeg 2>&1', $o, $ret);
  $ffmpeg = trim($o[0] ?? '');
  if ($ret !== 0 || !$ffmpeg){
    $detail = 'ffmpeg not installed';
    error_log(json_encode(['event'=>'ffmpeg-thumb-missing','src'=>$src,'ffmpeg'=>$ffmpeg,'detail'=>$detail]));
    return ['path'=>$fallback,'error'=>'ffmpeg not found','fallback'=>true,'detail'=>$detail];
  }

  $cmd = $ffmpeg . ' -hide_banner -loglevel error -ss 1 -i '.escapeshellarg($src).' -vframes 1 '.escapeshellarg($thumbDest).' 2>&1';
  $o = []; $ret = 0; exec($cmd, $o, $ret); $out = implode("\n", $o);
  if ($ret !== 0 || !file_exists($thumbDest)){
    error_log(json_encode(['event'=>'ffmpeg-thumb-failed','ffmpeg'=>$ffmpeg,'cmd'=>$cmd,'ret'=>$ret,'output'=>$out]));
    return ['path'=>$fallback,'error'=>'thumbnail generation failed','fallback'=>true,'detail'=>$out];
  }

  @chmod($thumbDest,0644); @chown($thumbDest,'www-data'); @chgrp($thumbDest,'www-data');
  return ['path'=>'/assets/media/img/'.basename($thumbDest),'error'=>null,'fallback'=>false,'detail'=>null];
}

if ($_SERVER['REQUEST_METHOD']!=='POST') fail('method');
if (!isset($_FILES['file'])) fail('nofile');

$u = $_FILES['file'];
if (!empty($u['error'])) fail('upload-error-'.$u['error']);
if (!is_uploaded_file($u['tmp_name'])) fail('tmp-missing');

// Limits (kann via PHP-INI/Nginx größer sein)
$maxBytes = 256*1024*1024; // 256MB
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

$baseDir = '/var/www/signage/assets/media/'.$subDir.'/';
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
// optional or auto-generated preview image (thumb)
$thumbPath = null;
$thumbError = null;
$thumbFallback = false;
$errorDetail = null;
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
  $tbase = '/var/www/signage/assets/media/img/';
  if (!is_dir($tbase)) { @mkdir($tbase, 02775, true); @chown($tbase,'www-data'); @chgrp($tbase,'www-data'); }
  $tdest = $tbase . $torig;
  $tpi = pathinfo($tdest);
  $tfname = $tpi['filename']; $ti=0;
  while (file_exists($tdest)) { $ti++; $tdest = $tpi['dirname'].'/'.$tfname.'_'.$ti.'.'.$text; }
  if (!@move_uploaded_file($tu['tmp_name'], $tdest)) fail('thumb-move-failed', 500);
  @chmod($tdest, 0644); @chown($tdest,'www-data'); @chgrp($tdest,'www-data');
  $thumbPath = '/assets/media/img/' . basename($tdest);
}

// auto-generate thumb for videos if not provided
if ($subDir === 'video' && !$thumbPath){
  $res = makeVideoThumb($dest, $fallbackThumb);
  $thumbPath = $res['path'];
  if ($res['error']) $thumbError = $res['error'];
  if ($res['fallback']) $thumbFallback = true;
  if ($res['detail']) $errorDetail = $res['detail'];
}

// final fallback to generic icon
if (!$thumbPath){
  $thumbPath = $fallbackThumb;
  $thumbFallback = true;
}

$resp = ['ok'=>true,'path'=>$publicPath,'thumb'=>$thumbPath];
if ($thumbError) $resp['error'] = $thumbError;
if ($thumbFallback) $resp['thumbFallback'] = true;
if ($errorDetail) $resp['errorDetail'] = $errorDetail;
echo json_encode($resp);
