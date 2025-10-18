<?php
// Gemeinsame Helfer für Dateipfade und JSON-Zugriff
// Stellt zentrale Funktionen bereit, damit Pfade nicht hart codiert werden
// und Deployments mit abweichenden Wurzelverzeichnissen funktionieren.

declare(strict_types=1);

const SIGNAGE_JSON_FLAGS = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT;

function signage_base_path(): string
{
    static $base = null;
    if ($base !== null) {
        return $base;
    }

    $candidates = [
        getenv('SIGNAGE_BASE_PATH') ?: null,
        $_ENV['SIGNAGE_BASE_PATH'] ?? null,
        $_SERVER['SIGNAGE_BASE_PATH'] ?? null,
        realpath(__DIR__ . '/../../') ?: (__DIR__ . '/../../'),
        $_SERVER['DOCUMENT_ROOT'] ?? null,
    ];

    foreach ($candidates as $candidate) {
        if (!is_string($candidate) || $candidate === '') {
            continue;
        }
        $resolved = realpath($candidate);
        if ($resolved !== false) {
            $candidate = $resolved;
        }
        if (!is_dir($candidate)) {
            continue;
        }

        $baseDir = rtrim($candidate, '/');
        if (is_dir($baseDir . '/data')) {
            return $base = $baseDir;
        }

        if (substr($baseDir, -6) === '/admin') {
            $parent = rtrim(dirname($baseDir), '/');
            if ($parent !== '' && is_dir($parent . '/data')) {
                return $base = $parent;
            }
        }
    }

    $fallback = realpath(__DIR__ . '/../../');
    if ($fallback === false) {
        $fallback = __DIR__ . '/../../';
    }

    return $base = rtrim($fallback, '/');
}

function signage_data_path(string $file = ''): string
{
    $dir = signage_base_path() . '/data';
    if ($file === '') {
        return $dir;
    }
    return $dir . '/' . ltrim($file, '/');
}

function signage_assets_path(string $path = ''): string
{
    $dir = signage_base_path() . '/assets';
    if ($path === '') {
        return $dir;
    }
    return $dir . '/' . ltrim($path, '/');
}

function signage_read_json(string $file, array $default = []): array
{
    $path = signage_data_path($file);
    if (!is_file($path)) {
        return $default;
    }
    $raw = @file_get_contents($path);
    if ($raw === false || $raw === '') {
        return $default;
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : $default;
}

function signage_write_json(string $file, $data, ?string &$error = null): bool
{
    $path = signage_data_path($file);
    $dir = dirname($path);
    if (!is_dir($dir) && !@mkdir($dir, 02775, true) && !is_dir($dir)) {
        $error = 'unable to create directory: ' . $dir;
        return false;
    }

    $json = json_encode($data, SIGNAGE_JSON_FLAGS);
    if ($json === false) {
        $error = 'json_encode failed: ' . json_last_error_msg();
        return false;
    }

    $temp = @tempnam($dir, basename($path) . '.tmp');
    if ($temp === false) {
        $error = 'unable to create temporary file';
        return false;
    }

    $handle = @fopen($temp, 'wb');
    if ($handle === false) {
        @unlink($temp);
        $error = 'unable to open temporary file for writing';
        return false;
    }

    $bytesWritten = @fwrite($handle, $json);
    if ($bytesWritten === false || $bytesWritten < strlen($json)) {
        $err = error_get_last();
        @fclose($handle);
        @unlink($temp);
        $error = $err['message'] ?? 'failed writing json payload';
        return false;
    }

    if (!@fflush($handle)) {
        @fclose($handle);
        @unlink($temp);
        $error = 'unable to flush json payload';
        return false;
    }

    if (function_exists('fsync')) {
        @fsync($handle);
    } elseif (function_exists('posix_fsync')) {
        $meta = @stream_get_meta_data($handle);
        if (isset($meta['stream_type']) && $meta['stream_type'] === 'STDIO') {
            @posix_fsync(@fileno($handle));
        }
    }

    @fclose($handle);

    if (!@rename($temp, $path)) {
        $err = error_get_last();
        @unlink($temp);
        $error = $err['message'] ?? 'rename failed';
        return false;
    }

    @chmod($path, 0644);
    return true;
}

function signage_absolute_path(string $relative): string
{
    if ($relative === '' || $relative[0] !== '/') {
        $relative = '/' . ltrim($relative, '/');
    }
    return signage_base_path() . $relative;
}

