<?php
// /admin/api/url_proxy.php – simple proxy to fetch remote pages and strip cookie banners
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store');

$url = $_GET['url'] ?? '';
if (!$url || !preg_match('~^https?://~i', $url)) {
    http_response_code(400);
    echo 'missing or invalid url';
    exit;
}

$ctxOpts = [
    'http' => [
        'method' => 'GET',
        'timeout' => 10,
        'header' => "User-Agent: HTMLSignage\r\n",
        'follow_location' => 1,
        'ignore_errors' => true,
    ],
    'https' => [
        'method' => 'GET',
        'timeout' => 10,
        'header' => "User-Agent: HTMLSignage\r\n",
        'follow_location' => 1,
        'ignore_errors' => true,
    ],
];

$context = stream_context_create($ctxOpts);
$html = @file_get_contents($url, false, $context);
if ($html === false) {
    http_response_code(502);
    echo 'failed to load url';
    exit;
}

// remove simple cookie/consent overlays
$patterns = [
    '/<script[^>]*cookie[^>]*>.*?<\/script>/is',
    '/<(?:div|section|aside)[^>]*(?:id|class)="[^"]*(cookie|consent)[^"]*"[^>]*>.*?<\/[^>]+>/is',
    '/<div[^>]*data-consent[^>]*>.*?<\/div>/is',
];
foreach ($patterns as $p) {
    $html = preg_replace($p, '', $html);
}

echo $html;
