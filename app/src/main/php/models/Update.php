<?php

class Update
{
    private Database $database;

    public function __construct()
    {
        $this->database = new Database();
    }

    public function printerStatusUpdate(): PDOStatement
    {
        return  $this->database->queryExec('UPDATE orders SET is_printed=1, custom="x" WHERE is_printed=0');
    }

    public function printerServiceOpenStatus(array $data): PDOStatement
    {
        return  $this->database->queryExec('UPDATE orders SET is_printed=0, custom="y" WHERE table_area=? AND table_number=?;', $data);
    }

    public function singlePrinterServiceOpenStatus(array $data): PDOStatement
    {
        return  $this->database->queryExec('UPDATE orders SET is_printed=0, custom="y" WHERE id=?;', $data);
    }

    public function tableAmountUpdate(array $data): PDOStatement
    {
        return  $this->database->queryExec('UPDATE tables SET table_amount = ? WHERE table_number = ? AND table_area = ?;', $data);
    }

    public function productCategoryUpdate(array $data): PDOStatement
    {
        return  $this->database->queryExec('UPDATE products SET category = ? WHERE category = ?;', $data);
    }

    public function productUpdate(array $data): PDOStatement
    {
        return  $this->database->queryExec('UPDATE products SET name = ?, price = ? WHERE id = ?;', $data);
    }

    public function categoryUpdate(array $data): PDOStatement
    {
        return  $this->database->queryExec('UPDATE categories SET name = ? WHERE id = ?;', $data);
    }

    public function tableStatusUpdate(array $data): PDOStatement
    {
        return  $this->database->queryExec('UPDATE tables SET table_status = ? WHERE table_number = ? AND table_area = ?;', $data);
    }

    public function productStatusUpdate(array $data): PDOStatement
    {
        return  $this->database->queryExec('UPDATE products SET status = ? WHERE id = ?;', $data);
    }

    public function categoryStatusUpdate(array $data): PDOStatement
    {
        return  $this->database->queryExec('UPDATE categories SET status = ? WHERE id = ?;', $data);
    }

    public function firstWaiterRemoval(array $data): PDOStatement
    {
        return  $this->database->queryExec('UPDATE tables SET opening_time = CURRENT_TIMESTAMP, first_waiter = ? WHERE first_waiter != "@@@" AND table_number = ? AND table_area = ?;', $data);
    }

    public function firstWaiterAssignment(array $data): PDOStatement
    {
        return  $this->database->queryExec('UPDATE tables SET opening_time = CURRENT_TIMESTAMP, first_waiter = ? WHERE first_waiter = "@@@" AND table_number = ? AND table_area = ?;', $data);
    }
}
