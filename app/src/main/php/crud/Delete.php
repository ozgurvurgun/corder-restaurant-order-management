<?php

class Delete
{
    private Database $database;

    public function __construct()
    {
        $this->database = new Database();
    }

    public function deleteOrder(array $data)
    {
        return  $this->database->queryExec('DELETE FROM orders WHERE table_number = ? AND table_area = ?', $data);
    }

    public function deleteReceipt(array $data)
    {
        return  $this->database->queryExec('DELETE FROM orders WHERE id = ?', $data);
    }

    public function deleteReceiptLog(array $data)
    {
        return  $this->database->queryExec('DELETE FROM orders_log WHERE old_id = ?', $data);
    }
}
