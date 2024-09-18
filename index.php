<?php

declare(strict_types=1);
ini_set('display_errors', 1);
error_reporting(E_ERROR | E_PARSE);
require_once './core/autoload.php';
new EnvLoader();
$addressManager = new Project();
$addressManager->main();
