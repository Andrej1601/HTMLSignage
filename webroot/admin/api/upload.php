<?php
// file: /var/www/signage/admin/api/upload.php
// Zweck: Sicheren Upload von Medien nach /assets/media/ (Bilder, Videos, MPD, HTML)
// Hinweise: Nginx client_max_body_size & PHP upload_max_filesize/post_max_size müssen groß genug sein.

header('Content-Type: application/json; charset=UTF-8');

function fail($msg, $code=400){ http_response_code($code); echo json_encode(['ok'=>false,'error'=>$msg]); exit; }

if ($_SERVER['REQUEST_METHOD']!=='POST') fail('method');
if (!isset($_FILES['file'])) fail('nofile');

$u = $_FILES['file'];
if (!empty($u['error'])) fail('upload-error-'.$u['error']);
if (!is_uploaded_file($u['tmp_name'])) fail('tmp-missing');

// Limits (kann via PHP-INI/Nginx größer sein)
$maxBytes = 256*1024*1024; // 256MB
if (filesize($u['tmp_name']) > $maxBytes) fail('too-large (server limit)');

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($u['tmp_name']) ?: 'application/octet-stream';
$allowed = [
  'image/png'        => ['ext'=>'png',  'dir'=>'img'],
  'image/jpeg'       => ['ext'=>'jpg',  'dir'=>'img'],
  'image/webp'       => ['ext'=>'webp', 'dir'=>'img'],
  'image/svg+xml'    => ['ext'=>'svg',  'dir'=>'img'],
  'video/mp4'        => ['ext'=>'mp4',  'dir'=>'video'],
  'application/dash+xml' => ['ext'=>'mpd', 'dir'=>'mpd'],
  'text/html'        => ['ext'=>'html', 'dir'=>'html']
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

if (!@move_uploaded_file($u['tmp_name'], $dest)) fail('move-failed', 500);
@chmod($dest, 0644); @chown($dest,'www-data'); @chgrp($dest,'www-data');

$publicPath = '/assets/media/'.$subDir.'/' . basename($dest);
echo json_encode(['ok'=>true,'path'=>$publicPath]);
