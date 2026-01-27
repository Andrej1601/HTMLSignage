<?php
/**
 * Apply Design Settings
 * Generates CSS variables from settings.json and injects them into the page
 */

require_once __DIR__ . '/admin/api/storage.php';

function getDesignCSS(): string {
    try {
        $db = signage_db();
        $stmt = $db->prepare('SELECT value FROM kv_store WHERE key = ?');
        $stmt->execute(['settings.state']);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row || !isset($row['value'])) {
            return '';
        }

        $settings = json_decode($row['value'], true);
        if (!$settings || !is_array($settings)) {
            return '';
        }

        // Extract theme colors
        $theme = $settings['theme'] ?? [];
        if (empty($theme)) {
            return '';
        }

        $css = ':root {' . PHP_EOL;

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
            'hlColor' => 'hlColor',
            'timeZebra1' => 'timeZebra1',
            'timeZebra2' => 'timeZebra2',
            'headRowBg' => 'headBg',
            'headRowFg' => 'headFg',
            'cornerBg' => 'cornerBg',
            'cornerFg' => 'cornerFg',
        ];

        foreach ($colorMap as $key => $cssVar) {
            if (isset($theme[$key]) && is_string($theme[$key]) && $theme[$key] !== '') {
                $css .= '  --' . $cssVar . ': ' . htmlspecialchars($theme[$key], ENT_QUOTES, 'UTF-8') . ';' . PHP_EOL;
            }
        }

        // Apply derived variables
        $css .= '  --gridTable: var(--grid);' . PHP_EOL;
        $css .= '  --tileBorder: var(--grid);' . PHP_EOL;
        $css .= '  --chipBorder: var(--grid);' . PHP_EOL;
        $css .= '  --badgeBg: var(--accent);' . PHP_EOL;
        $css .= '  --badgeFg: var(--boxfg);' . PHP_EOL;

        $css .= '}' . PHP_EOL;

        return $css;

    } catch (Exception $e) {
        error_log('[apply-design] Failed to load settings: ' . $e->getMessage());
        return '';
    }
}

// Output CSS if called directly
if (basename($_SERVER['SCRIPT_FILENAME']) === 'apply-design.php') {
    header('Content-Type: text/css; charset=UTF-8');
    echo getDesignCSS();
    exit;
}
