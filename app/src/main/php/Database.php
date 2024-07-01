<?php

class Database
{
    private ?PDO $db = null;
    private ?PDOStatement $stmt = null;
    private string $hostname;
    private string $username;
    private string $password;
    private string $databaseName;
    private string $charset;

    public function __construct()
    {
        $this->hostname = $_ENV['DATABASE_HOST'];
        $this->username = $_ENV['DATABASE_USERNAME'];
        $this->password = $_ENV['DATABASE_PASSWORD'];
        $this->databaseName = $_ENV['DATABASE_NAME'];
        $this->charset = $_ENV['DATABASE_CHARSET'];
        try {
            $this->db = new PDO("mysql:host=$this->hostname;dbname=$this->databaseName;charset=$this->charset", "$this->username", "$this->password");
            $this->db->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        } catch (PDOException $e) {
            die('<pre><span style="color:red">CONNECTION ERROR: </span>' . $e->getMessage() . '</pre>');
        }
    }

    public function queryExec(string $query, array $params = null): PDOStatement
    {
        if (is_null($params)) {
            $this->stmt = $this->db->query($query);
        } else {
            $this->stmt = $this->db->prepare($query);
            $this->stmt->execute($params);
        }
        return $this->stmt;
    }

    public function __destruct()
    {
        $this->db = null;
    }
}
