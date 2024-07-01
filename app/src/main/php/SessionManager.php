<?php

class SessionManager
{
    public function __construct()
    {
        session_start();
    }

    public function start(string $name, string $value): void
    {
        $_SESSION[$name] = $value;
    }

    public function stop(): void
    {
        session_unset();
        session_destroy();
    }

    public function sessionControl($sessionName, $sessionToken): bool
    {
        $select = new Select();
        $data = $select->getSystemUser([$_SESSION[$sessionName]]);
        if ($data && $data['token'] === $_SESSION[$sessionToken]) {
            return true;
        } else {
            return  false;
        }
    }
}
