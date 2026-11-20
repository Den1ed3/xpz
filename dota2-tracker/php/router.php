<?php
declare(strict_types=1);
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/' && is_file(__DIR__ . '/public/index.html')) {
    header('Content-Type: text/html; charset=utf-8');
    readfile(__DIR__ . '/public/index.html');
    return true;
}
if (in_array(rtrim((string)$path, '/'), ['/api/matches', '/api/replays', '/admin'], true)) {
    require __DIR__ . '/public/index.php';
    return true;
}
return false;
