<?php

class EnvLoader
{
    private string $path;
    private array $tmp_env = [];
    public function __construct()
    {
        $this->path = realpath('.env');

        if (!is_file($this->path))
            throw new ErrorException('Environment File is Missing.');
        if (!is_readable($this->path))
            throw new ErrorException('Permission Denied for reading the ' . ($this->path) . '.');

        $this->parse();
    }

    private function parse(): void
    {
        $fopen = fopen($this->path, 'r');
        if ($fopen) {
            while (($line = fgets($fopen)) !== false) {
                $line_is_comment = (substr(trim($line), 0, 1) == '#') ? true : false;
                if ($line_is_comment || empty(trim($line)))
                    continue;
                $line_no_comment = explode('#', $line, 2)[0];
                $env_ex = preg_split('/(\s?)\=(\s?)/', $line_no_comment);
                $env_name = trim($env_ex[0]);
                $env_value = isset($env_ex[1]) ? trim($env_ex[1]) : '';
                $this->tmp_env[$env_name] = $env_value;
            }
            fclose($fopen);
            $this->load();
        }
    }

    private function load(): void
    {
        foreach ($this->tmp_env as $name => $value) {
            putenv("{$name}=$value");
            if (is_numeric($value))
                $value = floatval($value);
            if (in_array(strtolower($value), ['true', 'false']))
                $value = (strtolower($value) == 'true') ? true : false;
            $_ENV[$name] = $value;
        }

        $this->tmp_env = [];
    }
}
