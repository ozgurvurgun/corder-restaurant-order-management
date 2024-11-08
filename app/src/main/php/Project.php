<?php

class Project
{
    private Http $http;
    private Security $security;
    private SessionManager $sessionManager;
    private Router $router;
    private EnvLoader $envLoader;
    private bool $logicSessionResult;
    private string $html = './app/src/main/web/';

    public function main(): void
    {
        header("Access-Control-Allow-Origin: *");
        header("Access-Control-Allow-Headers: Content-Type, Authorization");
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
        $this->initializeDependencies();
        $this->web();
        $this->api();
    }

    private function initializeDependencies(): void
    {
        $this->envLoader = new EnvLoader();
        $this->envLoader->trimKey('BASE_URL', '/', 'r');
        $this->sessionManager = new SessionManager();
        $this->router = new Router;
        $this->http = new Http($_SERVER['REQUEST_METHOD'], $this->router);
        $this->security = new Security();
        $this->logicSessionResult = $this->sessionManager->sessionControl('system-user', 'system-user-token');
    }


    function processOrders(array $data): array
    {
        $result = $data[0];
        $orderContents = array_merge(...array_map(fn($order) => json_decode($order['order_content'], true), $data));
        $result['order_content'] = json_encode($orderContents, JSON_UNESCAPED_UNICODE);
        $result['waiter_name'] = 'yazıcı servisi';
        unset($result['order_total']);
        return $result;
    }


    public function api(): void
    {
        $this->http->post('/order-service/last-order', function () {
            header('Content-Type: application/json; charset=utf-8');
            $select = new Select();
            $data = $select->getOrders();
            http_response_code($data ? 200 : 500);
            echo json_encode($data ? $data : ['status_code' => 'no_order'], JSON_UNESCAPED_UNICODE);
        });


        $this->http->post('/terminal-service/slip-printing', function () {
            header('Content-Type: application/json; charset=utf-8');
            $tableNumber =  $this->security->clientValidator($_POST['table-number']);
            $tableArea = $this->security->clientValidator($_POST['table-area']);
            $update = new Update();
            $result =  $update->printerServiceOpenStatus([$tableArea, $tableNumber]);
            http_response_code(200);
            echo json_encode(['status_code' => $result ? 'success' : 'no_order']);
        });


        $this->http->post('/order-service/printer-status-update', function () {
            $update = new Update();
            $result =  $update->printerStatusUpdate();
            http_response_code($result ? 200 : 500);
            echo json_encode(['status_code' => $result ? 'success' : 'xxxx']);
        });


        $this->http->post('/terminal-service/get-sub-users', function () {
            $select = new Select();
            $data = $select->getSubUsers();
            http_response_code($data && $this->logicSessionResult ? 200 : 401);
            echo json_encode($data && $this->logicSessionResult ? $data : ['status_code' => 'no_session'], true);
        });


        $this->http->post('/terminal-service/get-tables', function () {
            $select = new Select();
            $data = $select->getTables();
            http_response_code($data && $this->logicSessionResult ? 200 : 401);
            echo json_encode($data && $this->logicSessionResult ? $data : ['status_code' => 'no_session'], true);
        });


        $this->http->post('/terminal-service/get-tables-area', function () {
            $select = new Select();
            $data = $select->getTablesArea();
            http_response_code($data && $this->logicSessionResult ? 200 : 401);
            echo json_encode($data && $this->logicSessionResult ? $data : ['status_code' => 'no_session'], true);
        });


        $this->http->post('/terminal-service/get-table-numbers', function () {
            $select = new Select();
            $tableArea = $this->security->clientValidator($_POST['table-area']);
            $data = $select->getTableNumbers([$tableArea]);
            http_response_code($data && $this->logicSessionResult ? 200 : 401);
            echo json_encode($data && $this->logicSessionResult ? $data : ['status_code' => 'no_session'], true);
        });


        $this->http->post('/terminal-service/moving-table', function () {
            if (!$this->logicSessionResult) {
                http_response_code(401);
                die(json_encode(['status_code' => 'no_session']));
            }
            $tableArea =  $this->security->clientValidator($_POST['selected-table-area']);
            $tableNumber = $this->security->clientValidator($_POST['selected-table-number']);
            $newTableArea =  $this->security->clientValidator($_POST['new-table-area']);
            $newTableNumber = $this->security->clientValidator($_POST['new-table-number']);
            $select = new Select();
            $update = new Update();
            $resultOld = $select->tableByNumber([$tableArea, $tableNumber]);
            $resultNew = $select->tableByNumber([$newTableArea, $newTableNumber]);
            if (!$resultOld) {
                echo json_encode(['status_code' => 'wrong_table_selection']);
                die();
            }

            // if (!empty($select->getOrdersByTableNumber([$newTableArea, $newTableNumber]))) {
            //     echo json_encode(['status_code' => 'table_is_full']);
            //     die();
            // }

            $oldTableAmount = $resultOld['table_amount'];
            $newTableAmount = $resultNew['table_amount'];
            $oldWaiter = $resultOld['first_waiter'];

            //OLD TABLE
            $result1 = $update->tableStatusUpdate(['close', $tableNumber, $tableArea]);
            $result2 = $update->tableAmountUpdate(['0', $tableNumber, $tableArea]);
            $result3 = $update->firstWaiterRemoval(['@@@', $tableNumber, $tableArea]);

            //NEW TABLE
            $result4 = $update->tableStatusUpdate(['open', $newTableNumber, $newTableArea]);
            $result5 = $update->tableAmountUpdate([$oldTableAmount + $newTableAmount, $newTableNumber, $newTableArea]);
            // $result6 = $update->firstWaiterRemoval([$oldWaiter, $newTableNumber, $newTableArea]);

            $result6 = $update->firstWaiterMove([$oldWaiter, $newTableNumber, $newTableArea]);
            $result7 = $update->tableMove([$newTableArea, $newTableNumber, $tableNumber, $tableArea]);

            http_response_code($result1 && $result2 && $result3 && $result4 && $result5 && $result6 && $result7 ? 200 : 401);
            echo json_encode(['status_code' => $result1 && $result2 && $result3 && $result4 && $result5 && $result6 && $result7 ? 'success' : 'failure']);
        });


        $this->http->post('/terminal-service/get-receipt', function () {
            $tableNumber =  $this->security->clientValidator($_POST['table-number']);
            $tableArea = $this->security->clientValidator($_POST['table-area']);
            $select = new Select();
            $data = $select->getReceipt([$tableArea, $tableNumber]);
            http_response_code(200);
            if (!$data) {
                echo json_encode(['status_code' => 'no_receipt'], true);
            } else {
                echo json_encode($data, true);
            }
        });


        $this->http->post('/terminal-service/insert-category', function () {
            $io = new IO();
            $insert = new Insert();
            $select = new Select();
            $security = new Security();
            $categoryName = $security->clientValidator($_POST['category-name']);
            $categoryFile = $_FILES['category-file'];
            $count = $select->categoryExists($categoryName);

            if ($count > 0) {
                die(json_encode(['status_code' => 'already_registered'], true));
            }

            $fileName = $categoryName . '.png';
            $filePath = 'public/images/categories/';
            $result = $io->fileRecord($categoryFile, $fileName, $filePath, ['png']);

            if ($result) {
                $result =  $insert->insertCategory([$categoryName, $filePath . $fileName]);
                if ($result) {
                    echo json_encode(['status_code' => 'success'], true);
                } else {
                    echo json_encode(['status_code' => 'database_registration_error'], true);
                }
            } else {
                echo json_encode(['status_code' => 'file_download_error'], true);
            }
        });


        $this->http->post('/terminal-service/insert-product', function () {
            $io = new IO();
            $insert = new Insert();
            $select = new Select();
            $security = new Security();
            $productName = $security->clientValidator($_POST['product-name']);
            $selectedCategory = $security->clientValidator($_POST['selected-category']);
            $productPrice = $security->clientValidator($_POST['product-price']);
            $productFile = $_FILES['product-file'];
            $fileName = $selectedCategory . '-' . $productName . '.png';
            $filePath = 'public/images/products/';

            $count = $select->productExists($productName, $selectedCategory);
            if ($count > 0) {
                die(json_encode(['status_code' => 'already_registered'], true));
            }

            $result = $io->fileRecord($productFile, $fileName, $filePath, ['png']);
            if ($result) {
                $result =  $insert->insertProduct($productName, $selectedCategory, $productPrice, $filePath . $fileName);
                if ($result) {
                    echo json_encode(['status_code' => 'success'], true);
                } else {
                    echo json_encode(['status_code' => 'database_registration_error'], true);
                }
            } else {
                echo json_encode(['status_code' => 'file_download_error'], true);
            }
        });



        $this->http->post('/terminal-service/close-table', function () {
            if (!$this->logicSessionResult) {
                http_response_code(401);
                die(json_encode(['status_code' => 'no_session']));
            }

            $update = new Update();
            $delete = new Delete();
            $tableNumber =  $this->security->clientValidator($_POST['table-number']);
            $tableArea = $this->security->clientValidator($_POST['table-area']);
            $result1 = $update->tableStatusUpdate(['close', $tableNumber, $tableArea]);
            $result2 = $update->tableAmountUpdate(['0', $tableNumber, $tableArea]);
            $result3 = $update->firstWaiterRemoval(['@@@', $tableNumber, $tableArea]);
            $result4 = $delete->deleteOrder([$tableNumber, $tableArea]);
            http_response_code($result1 && $result2 && $result3 && $result4 ? 200 : 401);
            echo json_encode(['status_code' => $result1 && $result2 && $result3 && $result4 ? 'success' : 'failure']);
        });


        $this->http->post('/terminal-service/order-registration', function () {
            if (!$this->logicSessionResult) {
                http_response_code(401);
                die(json_encode(['status_code' => 'no_session']));
            }

            $insert = new Insert();
            $select = new Select();
            $update = new Update();

            $tableArea = $_POST['table-area'];
            $tableNumber = $_POST['table-number'];
            $cart = $_POST['cart'];
            $amount = $_POST['amount'];
            $waiter = $_POST['waiter'];
            $note = $_POST['note'];

            $result = $insert->insertOrder([$tableArea, $tableNumber, $cart, $amount, $waiter, $note, 1]);
            $data = $select->getOrdersByTableNumber([$tableNumber, $tableArea]);

            $totalPrice = 0;
            foreach ($data as $value) {
                $data = json_decode($value['order_content'], true);
                foreach ($data as  $value) {
                    $totalPrice += $value['product_price'] * $value['amount'];
                }
            }

            $update->tableAmountUpdate([$totalPrice, $tableNumber, $tableArea]);
            $update->tableStatusUpdate(['open', $tableNumber, $tableArea]);
            $update->firstWaiterAssignment([$waiter, $tableNumber, $tableArea]);

            http_response_code($result ? 200 : 500);
            echo json_encode(['status_code' => $result ? 'success' : 'failure']);
        });


        $this->http->post('/terminal-service/get-products', function () {
            $select = new Select();
            $data = $select->getActiveProducts();
            http_response_code($data && $this->logicSessionResult ? 200 : 401);
            echo json_encode($data && $this->logicSessionResult ? $data : ['status_code' => 'no_session'], true);
        });


        $this->http->post('/terminal-service/product-file-update', function () {
            $security = new Security();
            $id =  $security->clientValidator($_POST['product-id']);
            $productFile = $_FILES['product-file'];

            $select = new Select();
            $data =  $select->getProduct([$id]);
            $categoryName = $data['category'];
            $productName = $data['name'];

            $fileName = $categoryName . '-' . $productName . '.png';
            $filePath = 'public/images/products/';
            $io = new IO();

            http_response_code(200);
            if ($io->fileRecord($productFile, $fileName, $filePath, ['png'])) {
                echo json_encode(['status_code' => 'success'], true);
            } else {
                echo json_encode(['status_code' => 'file-update-failed'], true);
            }
        });


        $this->http->post('/terminal-service/category-file-update', function () {
            $security = new Security();
            $id =  $security->clientValidator($_POST['category-id']);
            $categoryFile = $_FILES['category-file'];
            $select = new Select();
            $data =  $select->getCategory([$id]);
            $categoryName = $data['name'];
            $fileName = $categoryName . '.png';
            $filePath = 'public/images/categories/';
            $io = new IO();

            http_response_code(200);
            if ($io->fileRecord($categoryFile, $fileName, $filePath, ['png'])) {
                echo json_encode(['status_code' => 'success'], true);
            } else {
                echo json_encode(['status_code' => 'file-update-failed'], true);
            }
        });


        $this->http->post('/terminal-service/get-categories', function () {
            $select = new Select();
            $data = $select->getActiveCategories();
            http_response_code($data && $this->logicSessionResult ? 200 : 401);
            echo json_encode($data && $this->logicSessionResult ? $data : ['status_code' => 'no_session'], true);
        });


        $this->http->post('/terminal-service/update-product', function () {
            $update = new Update();
            $security = new Security();
            $id = $security->clientValidator($_POST['id']);
            $productName = $security->clientValidator($_POST['product-name']);
            $productPrice = $security->clientValidator($_POST['product-price']);
            $result =  $update->productUpdate([$productName, $productPrice, $id]);

            if ($result) {
                echo json_encode(['status_code' => 'success'], true);
            } else {
                echo json_encode(['status_code' => 'update_failed'], true);
            }
        });


        $this->http->post('/terminal-service/update-category', function () {
            $update = new Update();
            $security = new Security();
            $select = new Select();

            $id = $security->clientValidator($_POST['id']);
            $categoryName = $security->clientValidator($_POST['category-name']);
            $oldCategoryName = $security->clientValidator($_POST['old-category-name']);

            $count = $select->categoryExists($categoryName);
            if ($count > 0) {
                die(json_encode(['status_code' => 'already_registered'], true));
            }

            $result = $update->categoryUpdate([$categoryName, $id]);
            $result2 = $update->productCategoryUpdate([$categoryName, $oldCategoryName]);

            if ($result && $result2) {
                echo json_encode(['status_code' => 'success'], true);
            } else {
                echo json_encode(['status_code' => 'update_failed'], true);
            }
        });


        $this->http->post('/terminal-service/product-status-update', function () {
            $update = new Update();
            $security = new Security();
            $id = $security->clientValidator($_POST['id']);
            $status = $security->clientValidator($_POST['status']);
            $result =  $update->productStatusUpdate([$status, $id]);

            if ($result) {
                echo json_encode(['status_code' => 'success'], true);
            } else {
                echo json_encode(['status_code' => 'update_failed'], true);
            }
        });


        $this->http->post('/terminal-service/category-status-update', function () {
            $update = new Update();
            $security = new Security();
            $id = $security->clientValidator($_POST['id']);
            $status = $security->clientValidator($_POST['status']);
            $result =  $update->categoryStatusUpdate([$status, $id]);

            if ($result) {
                echo json_encode(['status_code' => 'success'], true);
            } else {
                echo json_encode(['status_code' => 'update_failed'], true);
            }
        });


        $this->http->post('/system-user-control', function () {
            $userMail = $this->security->clientValidator($_POST['user-email']);
            $password = $this->security->clientValidator($_POST['password']);
            $user = (new Select())->getSystemUser([$userMail]);

            $isAuthenticated = $user['password'] === $password;
            http_response_code($isAuthenticated ? 200 : 401);
            echo json_encode(['status_code' => $isAuthenticated ? 'correct' : 'wrong']);

            if ($isAuthenticated) {
                $this->sessionManager->start('system-user', $userMail);
                $this->sessionManager->start('system-user-token', $user['token']);
            }
        });


        $this->http->post('/terminal-service/delete-receipt', function () {
            $id = $this->security->clientValidator($_POST['id']);
            $delete = new Delete();
            $select = new Select();
            $update = new Update();
            $result = $delete->deleteReceipt([$id]);
            $deleteReceiptLogResult = $delete->deleteReceiptLog([$id]);

            $tableArea = $_POST['table-area'];
            $tableNumber = $_POST['table-number'];

            $data = $select->getOrdersByTableNumber([$tableNumber, $tableArea]);

            $totalPrice = 0;
            foreach ($data as $value) {
                $data = json_decode($value['order_content'], true);
                foreach ($data as  $value) {
                    $totalPrice += $value['product_price'] * $value['amount'];
                }
            }

            $update->tableAmountUpdate([$totalPrice, $tableNumber, $tableArea]);

            if ($totalPrice == 0) {
                $result1 = $update->tableStatusUpdate(['close', $tableNumber, $tableArea]);
                $result2 = $update->tableAmountUpdate(['0', $tableNumber, $tableArea]);
                $result3 = $update->firstWaiterRemoval(['@@@', $tableNumber, $tableArea]);
            }

            echo json_encode($result ?  ['status_code' => 'success'] : ['status_code' => 'failure'], true);
        });


        $this->http->post('/terminal-service/single-slip-printing', function () {
            header('Content-Type: application/json; charset=utf-8');
            $id =  $this->security->clientValidator($_POST['id']);
            $update = new Update();
            $result =  $update->singlePrinterServiceOpenStatus([$id]);
            http_response_code(200);
            echo json_encode(['status_code' => $result ? 'success' : 'failure']);
        });
    }

    private function web(): void
    {
        $this->http->getWithParams('/kategoriler/{url}/{id}', function ($category, $id) {
            echo "<h1>$category</h1>";
            echo "<h1>$id</h1>";
        });


        $this->http->get('/', function () {
            $select = new Select();
            $categoryData = $select->getActiveCategories();
            $productData = $select->getActiveProducts();
            require_once $this->html . 'menu.php';
        });


        $this->http->get('/admin/dashboard', function () {
            $select = new Select();
            $orders = $select->getActiveOrders();
            require_once $this->html . 'admin/activeOrders.php';
        });


        $this->http->get('/admin/delivered', function () {
            $select = new Select();
            $orders = $select->getOrdersLog();
            require_once $this->html . 'admin/delivered.php';
        });


        $this->http->get('/admin/categories', function () {
            $select = new Select();
            $categoryData = $select->getAllCategories();
            require_once $this->html . 'admin/categories.php';
        });


        $this->http->get('/admin/products', function () {
            $select = new Select();
            $select = new Select();
            $categoryData = $select->getAllCategories();
            $productData = $select->getAllProducts();
            require_once $this->html . 'admin/products.php';
        });


        $this->http->get('/admin/tables', function () {
            require_once $this->html . 'admin/tables.php';
        });


        $this->http->get('/admin/z-report', function () {
            require_once $this->html . 'admin/zReport.php';
        });


        $this->http->get('/login', function () {
            http_response_code(200);
            // if ($this->logicSessionResult) header('Location: /terminal-users');
            require_once $this->html . 'terminal-screens/login.php';
        });


        $this->http->get('/terminal-users', function () {
            http_response_code(200);
            // if (!$this->logicSessionResult) header('Location: /logout');
            require_once $this->html . 'terminal-screens/terminalUsers.php';
        });


        $this->http->get('/receipt', function () {
            http_response_code(200);
            // if (!$this->logicSessionResult) header('Location: /logout');
            require_once $this->html . 'terminal-screens/receipt.php';
        });


        $this->http->get('/tables', function () {
            http_response_code(200);
            // if (!$this->logicSessionResult) header('Location: /logout');
            require_once $this->html . 'terminal-screens/tables.php';
        });


        $this->http->get('/table-operations', function () {
            http_response_code(200);
            // if (!$this->logicSessionResult) header('Location: /logout');
            require_once $this->html . 'terminal-screens/tableOperations.php';
        });


        $this->http->get('/terminal-menu', function () {
            http_response_code(200);
            // if (!$this->logicSessionResult) header('Location: /logout');
            require_once $this->html . 'terminal-screens/terminalMenu.php';
        });


        $this->http->get('/terminal-cart', function () {
            http_response_code(200);
            // if (!$this->logicSessionResult) header('Location: /logout');
            require_once $this->html . 'terminal-screens/terminalCart.php';
        });


        $this->http->get('/logout', function () {
            http_response_code(200);
            $this->sessionManager->stop();
            // header('Location: /');
        });


        if (!$this->router->getHasRoute()) {
            // header('Location: /');
            echo "404";
        }
    }
}
