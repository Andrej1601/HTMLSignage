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
$cacheKey = 'cache-manifest.v2';
$cachedManifest = signage_cache_get($cacheKey);
$previousFiles = [];
if (is_array($cachedManifest) && isset($cachedManifest['files']) && is_array($cachedManifest['files'])) {
    $previousFiles = $cachedManifest['files'];
}

$filesMeta = [];

function cache_manifest_collect_directory(
    string $keyPrefix,
    string $directory,
    string $urlPrefix,
    array &$urls,
    array &$filesMeta,
    array $previousFiles,
    $hashContext,
    ?callable $filter = null
): void {
    if (!is_dir($directory)) {
        return;
    }

    $normalizedDirectory = str_replace('\\', '/', rtrim($directory, '/'));
    $baseLength = strlen($normalizedDirectory);

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(
            $normalizedDirectory,
            FilesystemIterator::SKIP_DOTS | FilesystemIterator::FOLLOW_SYMLINKS
        )
    );

    foreach ($iterator as $fileInfo) {
        if (!$fileInfo->isFile()) {
            continue;
        }

        $absolutePath = str_replace('\\', '/', $fileInfo->getPathname());
        $relativePath = ltrim(substr($absolutePath, $baseLength), '/');
        if ($relativePath === '') {
            continue;
        }

        if ($filter !== null && !$filter($relativePath, $fileInfo)) {
            continue;
        }

        $url = $urlPrefix . $relativePath;
        $urls[] = $url;

        $metaKey = $keyPrefix . ':' . $relativePath;
        $currentMeta = [
            'mtime' => $fileInfo->getMTime(),
            'size' => $fileInfo->getSize(),
        ];
        $previousMeta = $previousFiles[$metaKey] ?? $previousFiles[$relativePath] ?? null;
        if (is_array($previousMeta)
            && isset($previousMeta['mtime'], $previousMeta['size'], $previousMeta['hash'])
            && (int) $previousMeta['mtime'] === (int) $currentMeta['mtime']
            && (int) $previousMeta['size'] === (int) $currentMeta['size']
        ) {
            $hash = (string) $previousMeta['hash'];
        } else {
            $hash = @hash_file('sha256', $fileInfo->getPathname());
            if ($hash === false) {
                $mtime = $currentMeta['mtime'];
                $hash = $mtime !== false ? (string) $mtime : 'missing';
            }
        }

        $currentMeta['hash'] = $hash;
        $filesMeta[$metaKey] = $currentMeta;
        hash_update($hashContext, $url . ':' . $hash);
    }
}

cache_manifest_collect_directory(
    'assets',
    $assetsDir,
    '/assets/',
    $urls,
    $filesMeta,
    $previousFiles,
    $hashContext,
    function (string $relativePath): bool {
        return strncmp($relativePath, 'media/', 6) !== 0;
    }
);

$basePath = signage_base_path();
cache_manifest_collect_directory(
    'player',
    $basePath . '/player/dist',
    '/player/dist/',
    $urls,
    $filesMeta,
    $previousFiles,
    $hashContext,
    function (string $relativePath): bool {
        return substr($relativePath, -4) !== '.map';
    }
);
cache_manifest_collect_directory(
    'admin',
    $basePath . '/admin/dist',
    '/admin/dist/',
    $urls,
    $filesMeta,
    $previousFiles,
    $hashContext,
    function (string $relativePath): bool {
        return substr($relativePath, -4) !== '.map';
    }
);

$offlinePath = signage_base_path() . '/offline.html';
if (is_file($offlinePath)) {
    $urls[] = '/offline.html';
    $currentMeta = [
        'mtime' => @filemtime($offlinePath) ?: null,
        'size' => @filesize($offlinePath) ?: null,
    ];
    $previousMeta = $previousFiles['__offline__'] ?? null;
    if (is_array($previousMeta)
        && isset($previousMeta['mtime'], $previousMeta['size'], $previousMeta['hash'])
        && (int) ($previousMeta['mtime'] ?? 0) === (int) ($currentMeta['mtime'] ?? 0)
        && (int) ($previousMeta['size'] ?? -1) === (int) ($currentMeta['size'] ?? -1)
    ) {
        $hash = (string) $previousMeta['hash'];
    } else {
        $hash = @hash_file('sha256', $offlinePath);
        if ($hash === false) {
            $mtime = $currentMeta['mtime'];
            $hash = $mtime !== null ? (string) $mtime : 'missing';
        }
    }
    $currentMeta['hash'] = $hash;
    $filesMeta['__offline__'] = $currentMeta;
    hash_update($hashContext, '/offline.html:' . $hash);
}

sort($urls);
$urls = array_values(array_unique($urls));

$version = hash_final($hashContext);
if (!is_string($version) || $version === '') {
    $version = sha1((string) microtime(true));
}

$payload = [
    'ok' => true,
    'version' => $version,
    'urls' => $urls,
];

echo json_encode($payload, SIGNAGE_JSON_RESPONSE_FLAGS);

signage_cache_set($cacheKey, [
    'version' => $version,
    'urls' => $urls,
    'files' => $filesMeta,
    'generated_at' => time(),
]);
