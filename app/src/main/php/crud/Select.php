<?php

class Select
{
    private Database $database;

    public function __construct()
    {
        $this->database = new Database();
    }

    public function getOrders(): array
    {
        return $this->database->queryExec('SELECT * FROM orders WHERE is_printed=0')->fetchAll();
    }

    public function getActiveOrders(): array
    {
        return $this->database->queryExec('SELECT * FROM orders ORDER BY order_time DESC')->fetchAll();
    }

    public function getOrdersLog(): array
    {
        return $this->database->queryExec('SELECT * FROM orders_log ORDER BY order_closing_time DESC, table_opening_time DESC')->fetchAll();
    }

    public function getSystemUser(array $data): array|bool
    {
        return $this->database->queryExec('SELECT * FROM system_users WHERE email = ?', $data)->fetch();
    }

    public function getSubUsers(): array
    {
        return $this->database->queryExec('SELECT * FROM sub_users')->fetchAll();
    }

    public function getOpenOrders(): array
    {
        return $this->database->queryExec('SELECT * FROM orders WHERE table_area=? AND table_number=?')->fetchAll();
    }

    public function getTables(): array
    {
        return $this->database->queryExec('SELECT * FROM tables ORDER BY table_area ASC, table_number ASC')->fetchAll();
    }

    public function getTableNumbers(array $data): array
    {
        return $this->database->queryExec('SELECT * FROM tables WHERE table_area=? ORDER BY table_number ASC', $data)->fetchAll();
    }

    public function getReceipt(array $data): array
    {
        return $this->database->queryExec('SELECT * FROM orders WHERE table_area=? AND table_number=? ORDER BY id ASC', $data)->fetchAll();
    }

    public function getAllProducts(): array
    {
        return $this->database->queryExec('SELECT * FROM products ORDER BY category ASC')->fetchAll();
    }

    public function getProduct(array $id): array|bool
    {
        return $this->database->queryExec('SELECT * FROM products WHERE id=?', $id)->fetch();
    }

    public function getCategory(array $id): array|bool
    {
        return $this->database->queryExec('SELECT * FROM categories WHERE id=?', $id)->fetch();
    }

    public function getActiveProducts(): array
    {
        return $this->database->queryExec('SELECT * FROM products WHERE status=1 ORDER BY category ASC')->fetchAll();
    }

    public function getOrdersByTableNumber(array $data): array
    {
        return $this->database->queryExec('SELECT * FROM orders WHERE table_number=? AND table_area=? ORDER BY table_number ASC', $data)->fetchAll();
    }

    public function getActiveCategories(): array
    {
        return $this->database->queryExec('SELECT * FROM categories WHERE status=1 ORDER BY id ASC')->fetchAll();
    }

    public function getAllCategories(): array
    {
        return $this->database->queryExec('SELECT * FROM categories ORDER BY id ASC')->fetchAll();
    }

    public function getTablesArea(): array
    {
        return $this->database->queryExec('SELECT DISTINCT table_area FROM tables;')->fetchAll();
    }

    public function categoryExists($name): int
    {
        return $this->database->queryExec('SELECT COUNT(*) FROM categories WHERE name = ?', [$name])->fetchColumn();
    }

    public function productExists(string $name, string $category): int
    {
        return $this->database->queryExec('SELECT COUNT(*) FROM products WHERE name = ? AND category = ?', [$name, $category])->fetchColumn();
    }

    public function tableByNumber(array $data): array
    {
        return $this->database->queryExec('SELECT * FROM tables WHERE table_area = ? AND table_number = ?', $data)->fetch();
    }
}
