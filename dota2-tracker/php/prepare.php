<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
$src = dirname(__DIR__) . '/ui';
$dest = __DIR__ . '/public';
if (!is_file($src . '/index.html')) {
    fwrite(STDERR, "The ui/index.html source is missing.\n");
    exit(1);
}
$files = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($src, FilesystemIterator::SKIP_DOTS));
foreach ($files as $file) {
    if (!$file->isFile() || $file->isLink()) { continue; }
    $relative = substr($file->getPathname(), strlen($src) + 1);
    if (!in_array(strtolower($file->getExtension()), ['html','js','css','json','svg','png','jpg','jpeg','webp','glb','gltf','bin','avif','webm','mp4','woff','woff2','ico','gif'], true)) { continue; }
    $target = $dest . '/' . $relative;
    if (!is_dir(dirname($target)) && !mkdir(dirname($target), 0755, true)) { exit(1); }
    if (!copy($file->getPathname(), $target)) { exit(1); }
}
echo "Web root ready at $dest\n";
