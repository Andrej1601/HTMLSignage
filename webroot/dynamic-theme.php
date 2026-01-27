<?php
/**
 * Dynamic Theme CSS Generator
 * Serves CSS variables from database settings
 */

require_once __DIR__ . '/admin/api/storage.php';

header('Content-Type: text/css; charset=UTF-8');
header('Cache-Control: no-store, must-revalidate');

try {
    $db = signage_db();
    $stmt = $db->prepare('SELECT value FROM kv_store WHERE key = ?');
    $stmt->execute(['settings.state']);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row || !isset($row['value'])) {
        echo '/* No settings found */';
        exit;
    }

    $settings = json_decode($row['value'], true);
    if (!$settings || !is_array($settings)) {
        echo '/* Invalid settings */';
        exit;
    }

    $theme = $settings['theme'] ?? [];
    if (empty($theme)) {
        echo '/* No theme settings */';
        exit;
    }

    // Use higher specificity to override design.css
    echo "/* Dynamic Theme - Generated from Database */\n";
    echo "html:root, :root {\n";

    // Map theme colors to CSS variables
    $colorMap = [
        'bg' => 'bg',
        'fg' => 'fg',
        'accent' => 'accent',
        'gridTable' => 'grid',
        'cellBg' => 'cell',
        'boxFg' => 'boxfg',
        'timeColBg' => 'timecol',
        'flame' => 'flame',
        'zebra1' => 'zebra1',
        'zebra2' => 'zebra2',
        'timeZebra1' => 'timeZebra1',
        'timeZebra2' => 'timeZebra2',
        'headRowBg' => 'headBg',
        'headRowFg' => 'headFg',
        'cornerBg' => 'cornerBg',
        'cornerFg' => 'cornerFg',
    ];

    foreach ($colorMap as $dbKey => $cssVar) {
        if (isset($theme[$dbKey]) && is_string($theme[$dbKey]) && $theme[$dbKey] !== '') {
            $value = htmlspecialchars($theme[$dbKey], ENT_QUOTES, 'UTF-8');
            echo "  --{$cssVar}: {$value} !important;\n";
        }
    }

    // Derived variables
    echo "  --gridTable: var(--grid) !important;\n";
    echo "  --tileBorder: var(--grid) !important;\n";
    echo "  --chipBorder: var(--grid) !important;\n";
    echo "  --badgeBg: var(--accent) !important;\n";
    echo "  --badgeFg: var(--boxfg) !important;\n";

    echo "}\n";

} catch (Exception $e) {
    echo "/* Error: " . addslashes($e->getMessage()) . " */\n";
}
