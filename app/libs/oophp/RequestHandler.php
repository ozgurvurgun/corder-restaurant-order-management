<?php

class RequestHandler
{
    private string $requestMethod;
    private Router $router;

    public function __construct(string $requestMethod, Router $router)
    {
        $this->requestMethod = $requestMethod;
        $this->router = $router;
    }

    public function post(string $path, callable $func): void
    {
        $this->handleRequest('POST', $path, $func);
    }

    public function postWithParams(string $path, callable $func): void
    {
        $this->handleRequestWithParams('POST', $path, $func);
    }

    public function get(string $path, callable $func): void
    {
        $this->handleRequest('GET', $path, $func);
    }

    public function getWithParams(string $path, callable $func): void
    {
        $this->handleRequestWithParams('GET', $path, $func);
    }

    private function handleRequest(string $method, string $path, callable $func): void
    {
        if ($this->requestMethod === $method) {
            $this->router->run($path, $func);
        }
    }

    private function handleRequestWithParams(string $method, string $path, callable $func): void
    {
        if ($this->requestMethod === $method) {
            $this->router->runWithParams($path, $func);
        }
    }
}
