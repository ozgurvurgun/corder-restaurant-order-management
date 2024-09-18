<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <!-- font awesome -->
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
    <link rel="shortcut icon" href="<?= $_ENV['BASE_URL'] ?>public/images/32x32-icon.png" type="image/x-icon" />
    <link rel="stylesheet" href="<?= $_ENV['BASE_URL'] ?>public/css/admin-panel-skeleton.css" />
    <link rel="stylesheet" href="<?= $_ENV['BASE_URL'] ?>public/css/table.css" />
    <link rel="stylesheet" href="<?= $_ENV['BASE_URL'] ?>public/css/switcher.css" />
    <link rel="stylesheet" href="<?= $_ENV['BASE_URL'] ?>public/css/modal.css" />
    <link rel="stylesheet" href="<?= $_ENV['BASE_URL'] ?>public/css/file-select-button.css" />
    <title>Corder | Kategoriler</title>
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
                    <a href="<?= $_ENV['BASE_URL'] ?>admin/dashboard">
                        <i class="fa-solid fa-gauge"></i>
                        <span class="link-name">Aktif Siparişler</span>
                    </a>
                </li>
                <li>
                    <a href="<?= $_ENV['BASE_URL'] ?>admin/delivered">
                        <i class="fa-solid fa-gauge"></i>
                        <span class="link-name">Teslim Edilenler</span>
                    </a>
                </li>
                <li>
                    <a href="<?= $_ENV['BASE_URL'] ?>admin/tables">
                        <i class="fa-solid fa-magnifying-glass-chart"></i>
                        <span class="link-name">Sistem</span>
                    </a>
                </li>
                <li class="active">
                    <a href="<?= $_ENV['BASE_URL'] ?>admin/categories">
                        <i class="fa-solid fa-book"></i>
                        <span class="link-name">Kategoriler</span>
                    </a>
                </li>
                <li>
                    <a href="<?= $_ENV['BASE_URL'] ?>admin/products">
                        <i class="fa-solid fa-book"></i>
                        <span class="link-name">Ürünler</span>
                    </a>
                </li>
                <li>
                    <a href="<?= $_ENV['BASE_URL'] ?>admin/z-report">
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

        /* category-file */
        .category-file {
            display: flex;
            flex-direction: column;
            flex-wrap: wrap;
            align-items: center;
            justify-content: center;
            gap: 20px;
        }

        .category-file-button {
            position: relative;
            padding: 11px 16px;
            font-size: 14px;
            line-height: 1.5;
            border-radius: 5px;
            color: #fff;
            background-color: #17a2b8;
            border: none;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .category-file-button input[type="file"] {
            cursor: pointer;
            position: absolute;
            left: 0;
            top: 0;
            transform: scale(5);
            opacity: 0;
        }

        .category-file-filename p {
            font-size: 14px;
            color: #738191;
        }

        .content-wrapper .left {
            border-right: 1px solid grey;
            display: flex;
            flex-direction: column;
            gap: 20px;
            align-items: center;
            justify-content: center;
        }

        .content-wrapper .right {
            overflow: hidden;
        }

        .category-name-input {
            text-align: center;
            font-size: 18px;
            padding: 5px;
            border: none;
            border-bottom: 1px solid grey;
            outline: none;
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
                <input class="category-name-input" placeholder="Kategori Adı" type="text">
                <div class="category-file">
                    <button type="button" class="category-file-button">
                        <span><i class="fa-solid fa-upload"></i>&nbsp;&nbsp;&nbsp;Kategori Fotoğrafı</span>
                        <input accept=".png" type="file" id="category-file">
                    </button>
                    <div class="category-file-filename">
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
                                <th>Kategori Adı</th>
                                <th>Kategori Resmi</th>
                                <th>Kategori Durumu</th>
                                <th>Güncelle/Sil</th>
                            </tr>
                        </thead>
                        <tbody class="category-data-table">
                            <?php foreach ($categoryData as $value) : ?>
                                <tr id="">
                                    <td id="category-table-category-name-<?= $value['id'] ?>"><?= $value['name'] ?></td>
                                    <td><img id="category-file-<?= $value['id'] ?>" class="lazy" data-src="<?= $_ENV['BASE_URL'] ?><?= $value['image_path'] ?>?cache-timestamp=<?= time() ?>" src="<?= $_ENV['BASE_URL'] ?>public/images/ui/logo.jpg" /></td>
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
                <h2>Kategori Güncelleme Formu</h2>
                <span id="modal-close-button" class="close">&times;</span>
            </div>
            <div class="modal-body">
                <div>
                    <label for="modal-category-name">Kategori Adı</label>
                    <input id="modal-category-name" type="text">
                </div>
                <div>
                    <button style="height: 30px;" type="button" class="file-update-button file-select-button">
                        <span><i class="fa-solid fa-upload"></i>&nbsp;&nbsp;&nbsp;Kategori Fotoğrafı</span>
                        <input accept=".png" type="file" id="new-category-file">
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
        const baseUrl = "<?= $_ENV['BASE_URL'] ?>";
    </script>
    <script type="module" src="<?= $_ENV['BASE_URL'] ?>public/js/AdminMain.js"></script>
</body>

</html>