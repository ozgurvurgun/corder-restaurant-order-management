<?php

class Security
{
    public function clientValidator(string $data): string
    {
        return trim(htmlspecialchars(mb_strtolower($data)));
    }
}
