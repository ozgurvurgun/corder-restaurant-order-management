<?php
function autoloader(string $dir): void
{
    $files = array_diff(scandir($dir), ['..', '.']);
    foreach ($files as $file) {
        $filePath = $dir . '/' . $file;
        if (is_dir($filePath)) {
            autoloader($filePath);
        } elseif (pathinfo($filePath, PATHINFO_EXTENSION) === 'php') {
            require_once $filePath;
        }
    }
}

autoloader('./app/libs');
autoloader('./app/src/main/php');
