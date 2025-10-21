<?php
declare(strict_types=1);

require_once __DIR__ . '/../admin/api/storage.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');

$assetsDir = signage_assets_path();
$urls = [];
$hashContext = hash_init('sha256');

if (is_dir($assetsDir)) {
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(
            $assetsDir,
            FilesystemIterator::SKIP_DOTS | FilesystemIterator::FOLLOW_SYMLINKS
        )
    );
    foreach ($iterator as $fileInfo) {
        if (!$fileInfo->isFile()) {
            continue;
        }
        $relativePath = ltrim(str_replace('\\', '/', substr($fileInfo->getPathname(), strlen($assetsDir))), '/');
        if ($relativePath === '' || strncmp($relativePath, 'media/', 6) === 0) {
            continue;
        }
        $url = '/assets/' . $relativePath;
        $urls[] = $url;
        $hash = @hash_file('sha256', $fileInfo->getPathname());
        if ($hash === false) {
            $mtime = @filemtime($fileInfo->getPathname());
            $hash = $mtime !== false ? (string) $mtime : 'missing';
        }
        hash_update($hashContext, $url . ':' . $hash);
    }
}

$offlinePath = signage_base_path() . '/offline.html';
if (is_file($offlinePath)) {
    $urls[] = '/offline.html';
    $hash = @hash_file('sha256', $offlinePath);
    if ($hash === false) {
        $mtime = @filemtime($offlinePath);
        $hash = $mtime !== false ? (string) $mtime : 'missing';
    }
    hash_update($hashContext, '/offline.html:' . $hash);
}

sort($urls);
$urls = array_values(array_unique($urls));

$version = hash_final($hashContext);
if (!is_string($version) || $version === '') {
    $version = sha1((string) microtime(true));
}

echo json_encode([
    'ok' => true,
    'version' => $version,
    'urls' => $urls,
], SIGNAGE_JSON_RESPONSE_FLAGS);
