<!DOCTYPE html>

<html lang="en">



<head>

    <meta charset="UTF-8" />

    <meta name="viewport" content="width=device-width, initial-scale=1.0" />

    <!-- font awesome -->

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />

    <link rel="shortcut icon" href="<?= $_ENV['BASE_URL'] ?>/public/images/32x32-icon.png" type="image/x-icon" />

    <link rel="stylesheet" href="<?= $_ENV['BASE_URL'] ?>/public/css/admin-panel-skeleton.css" />

    <link rel="stylesheet" href="<?= $_ENV['BASE_URL'] ?>/public/css/table.css" />

    <link rel="stylesheet" href="<?= $_ENV['BASE_URL'] ?>/public/css/switcher.css" />

    <link rel="stylesheet" href="<?= $_ENV['BASE_URL'] ?>/public/css/modal.css" />

    <link rel="stylesheet" href="<?= $_ENV['BASE_URL'] ?>/public/css/file-select-button.css" />

    <title>Corder | Ürünler</title>

</head>



<body>

    <!-- SIDEBAR START -->

    <nav>

        <div class="logo">

            <div class="logo-image">

                <i class="fas fa-cookie-bite"></i>

            </div>

            <span class="logo-name">Corder Panel</span>

        </div>

        <div class="menu-items">

            <ul class="nav-links">

                <li>

                    <a href="<?= $_ENV['BASE_URL'] ?>/admin/dashboard">

                        <i class="fa-solid fa-gauge"></i>

                        <span class="link-name">Aktif Siparişler</span>

                    </a>

                </li>

                <li>

                    <a href="<?= $_ENV['BASE_URL'] ?>/admin/delivered">

                        <i class="fa-solid fa-gauge"></i>

                        <span class="link-name">Teslim Edilenler</span>

                    </a>

                </li>

                <li>

                    <a href="<?= $_ENV['BASE_URL'] ?>/admin/tables">

                        <i class="fa-solid fa-magnifying-glass-chart"></i>

                        <span class="link-name">Sistem</span>

                    </a>

                </li>

                <li>

                    <a href="<?= $_ENV['BASE_URL'] ?>/admin/categories">

                        <i class="fa-solid fa-book"></i>

                        <span class="link-name">Kategoriler</span>

                    </a>

                </li>

                <li class="active">

                    <a href="<?= $_ENV['BASE_URL'] ?>/admin/products">

                        <i class="fa-solid fa-book"></i>

                        <span class="link-name">Ürünler</span>

                    </a>

                </li>

                <li>

                    <a href="<?= $_ENV['BASE_URL'] ?>/admin/z-report">

                        <i class="fa-solid fa-book"></i>

                        <span class="link-name">Z Raporu</span>

                    </a>

                </li>

            </ul>

            <ul class="logout-mode">

                <li>

                    <a href="https://panel.kolayki.co/logout">

                        <i class="fa-solid fa-arrow-right-from-bracket"></i>

                        <span class="link-name">Çıkış</span>

                    </a>

                </li>

                <li class="mode">

                    <a href="javascript:void(0)">

                        <i class="fa-regular fa-moon"></i>

                        <span class="link-name">Koyu Mod</span>

                    </a>



                    <div class="mode-toggle">

                        <span class="switch"></span>

                    </div>

                </li>

            </ul>

        </div>

    </nav>

    <!-- SIDEBAR END -->



    <!-- MAIN START -->

    <style>

        .content-wrapper {

            display: grid;

            grid-template-columns: 0.4fr 1fr;

            width: 100%;

            height: 100%;

        }



        input[type=number]::-webkit-outer-spin-button,

        input[type=number]::-webkit-inner-spin-button {

            -webkit-appearance: none;

            margin: 0;

        }



        .content-wrapper .left {

            border-right: 1px solid grey;

            display: flex;

            flex-direction: column;

            gap: 30px;

            align-items: center;

            justify-content: center;

        }



        .content-wrapper .right {

            overflow: hidden;

        }



        main input {

            text-align: center;

            font-size: 18px;

            padding: 5px;

            border: none;

            border-bottom: 1px solid grey;

            outline: none;

        }



        .register-button {

            margin-top: 25px;

            padding: 15px;

            border: none;

            background-color: #FCDC94;

            font-weight: 800;

            color: grey;

            border-radius: 5px;

            cursor: pointer;

        }



        select {

            border: 1px solid grey;

            border-radius: 5px;

            outline: none;

            padding: 10px 15px;

        }

    </style>

    <main>

        <div class="content-wrapper">

            <div class="left">

                <input class="product-name-input" placeholder="Ürün Adı" type="text">

                <input class="product-price-input" placeholder="Ürün Fiyatı" type="number">

                <select id="selected-category">

                    <option selected value="0">Ürünün Ekleneceği Kategori</option>

                    <?php foreach ($categoryData as $value) : ?>

                        <option value="<?= $value['name'] ?>"><?= $value['name'] ?></option>

                    <?php endforeach; ?>

                </select>

                <div class="file-select-button-wrapper">

                    <button type="button" class="file-select-button">

                        <span><i class="fa-solid fa-upload"></i>&nbsp;&nbsp;&nbsp;Ürün Fotoğrafı</span>

                        <input accept=".png" type="file" id="product-file">

                    </button>

                    <div class="product-file-filename">

                        <p></p>

                    </div>

                </div>

                <button class="register-button">Kayıt Et</button>

            </div>

            <div class="right">

                <div class="table-section">

                    <table>

                        <thead>

                            <tr>

                                <th>Kategori</th>

                                <th>Ürün Adı</th>

                                <th>Ürün Fiyatı</th>

                                <th>Ürün Resmi</th>

                                <th>Ürün Durumu</th>

                                <th>Güncelle/Sil</th>

                            </tr>

                        </thead>

                        <tbody class="category-data-table">

                            <?php foreach ($productData as $value) : ?>

                                <tr id="product-table-<?= $value['id'] ?>">

                                    <td id="product-table-category-<?= $value['id'] ?>"><?= $value['category'] ?></td>

                                    <td id="product-table-product-name-<?= $value['id'] ?>"><?= $value['name'] ?></td>

                                    <td id="product-table-product-price-<?= $value['id'] ?>"><?= $value['price'] ?></td>

                                    <td><img id="product-file-<?= $value['id'] ?>" class="lazy" data-src="<?= $_ENV['BASE_URL'] ?>/<?= $value['image_path'] ?>?cache-timestamp=<?= time() ?>" src="<?= $_ENV['BASE_URL'] ?>/public/images/ui/logo.jpg" /></td>

                                    <td>

                                        <input <?= $value['status'] == 1 ? 'checked' : '' ?> hidden type="checkbox" id="switcher-<?= $value['id'] ?>" />

                                        <label class="switcher" data-id="<?= $value['id'] ?>" for="switcher-<?= $value['id'] ?>"></label>

                                    </td>

                                    <td>

                                        <button data-id="<?= $value['id'] ?>" class="modal-open-button"><i class="fa-solid fa-pen-to-square"></i></button>

                                        <button><i class="fa-solid fa-trash-can"></i></button>

                                    </td>

                                </tr>

                            <?php endforeach; ?>

                        </tbody>

                    </table>

                </div>

            </div>

    </main>



    <style>

        #modal .modal-body {

            display: flex;

            align-items: center;

            flex-direction: column;

            gap: 15px;

        }



        #modal .modal-body div {

            display: flex;

            flex-direction: column;

            gap: 5px;

        }



        #modal .modal-body div input {

            width: 500px;

            height: 30px;

            font-size: 18px;

            outline: none;

            border: 1px solid grey;

            padding: 15px;

            border-radius: 5px;

        }



        #modal .modal-body div button {

            width: 200px;

            font-weight: 600;

        }



        .file-update-button {

            margin-top: 40px;

        }



        .modal-update-button {

            background-color: #95D2B3;

            color: #738191;

            padding: 10px;

            font-size: 16px;

            border-radius: 5px;

            border: none;

            cursor: pointer;

        }

    </style>



    <div id="modal" class="modal">

        <!-- Modal content -->

        <div class="modal-content">

            <div class="modal-header">

                <h2>Ürün Güncelleme Formu</h2>

                <span id="modal-close-button" class="close">&times;</span>

            </div>

            <div class="modal-body">

                <div>

                    <label for="modal-product-name">Ürün Adı</label>

                    <input id="modal-product-name" type="text">

                </div>

                <div>

                    <label for="modal-product-price">Ürün Fiyatı</label>

                    <input id="modal-product-price" type="number">

                </div>

                <div>

                    <button style="height: 30px;" type="button" class="file-update-button file-select-button">

                        <span><i class="fa-solid fa-upload"></i>&nbsp;&nbsp;&nbsp;Ürün Fotoğrafı</span>

                        <input accept=".png" type="file" id="new-product-file">

                    </button>

                </div>

                <div>

                    <button class="modal-update-button">Güncelle</button>

                </div>

            </div>

        </div>

    </div>

    <!-- MAIN END -->

    <script>

        const baseUrl = "<?= $_ENV['BASE_URL'] ?>/";

    </script>

    <script type="module" src="<?= $_ENV['BASE_URL'] ?>/public/js/AdminMain.js"></script>

</body>



</html>