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
        if (is_dir($candidate)) {
            $base = rtrim($candidate, '/');
            if (is_dir($base . '/data') || substr($base, -6) !== '/admin') {
                return $base;
            }
            $parent = rtrim(dirname($base), '/');
            if ($parent !== '' && is_dir($parent . '/data')) {
                return $base = $parent;
            }
        }
    }

    return $base = rtrim(__DIR__ . '/../../', '/');
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
    $bytes = @file_put_contents($path, $json, LOCK_EX);
    if ($bytes === false) {
        $err = error_get_last();
        $error = $err['message'] ?? 'file_put_contents failed';
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

