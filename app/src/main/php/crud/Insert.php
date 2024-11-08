<?php

class Insert
{
    private Database $database;

    public function __construct()
    {
        $this->database = new Database();
    }

    public function insertOrder(array $data): PDOStatement
    {
        return $this->database->queryExec('INSERT INTO orders (table_area, table_number, order_content, order_total, waiter_name, order_note, is_table_open) VALUES(?, ?, ?, ?, ?, ?, ?)', $data);
    }

    public function insertCategory(array $data): PDOStatement
    {
        return $this->database->queryExec('INSERT INTO categories (name, image_path) VALUES(?, ?)', $data);
    }

    public function insertProduct(string $name, string $category, string $price, string $imagePath): PDOStatement
    {
        return $this->database->queryExec('INSERT INTO products (name, category, price, image_path) VALUES(?, ?, ?, ?)', [$name, $category, $price, $imagePath]);
    }
}
