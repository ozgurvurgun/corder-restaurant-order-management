<?php

class Router
{
    private bool $hasRoute = false;
    private string $location;

    public function __construct()
    {
        $splitUrl = explode('/', rtrim($_ENV['BASE_URL'], '/'));
        $basePath = '/' . end($splitUrl);
        $request_uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $request_uri = str_replace($basePath, '', $request_uri);
        if ($request_uri !== '/') {
            $request_uri = rtrim($request_uri, '/');
        }
        $this->location = $request_uri;
    }

    public function location(): string
    {
        return $this->location;
    }

    public function run(string $path, callable $func): void
    {
        if ($this->location === $path) {
            $this->hasRoute = true;
            call_user_func($func);
        }
    }


    public function runWithParams(string $path, callable $func): void
    {
        $pattern = preg_replace('/\{url\}/', '([a-zA-Z0-9_]+)', $path);
        $pattern = preg_replace('/\{id\}/', '([0-9]+)', $pattern);
        $pattern = str_replace('/', '\/', $pattern);
        $pattern = '/^' . $pattern . '$/';

        if (preg_match($pattern, $this->location, $matches)) {
            array_shift($matches); // Remove the full match
            $this->hasRoute = true;
            call_user_func_array($func, $matches);
        }
    }

    public function getHasRoute(): bool
    {   //To prevent redirection when POST request arrives
        if ($_SERVER['REQUEST_METHOD'] === 'POST') {
            return true;
        } else {
            return $this->hasRoute;
        }
    }
}
