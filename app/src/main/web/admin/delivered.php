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

    <title>Corder | Teslim Edilenler</title>

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

                <li class="active">

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

                <li>

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

            grid-template-columns: 1fr;

            width: 100%;

            height: 100%;

        }

    </style>

    <main>

        <div class="content-wrapper">

            <div class="table-section">

                <table>

                    <thead>

                        <tr>

                            <th>Masa</th>

                            <th style="width: 500px;">Adisyon</th>

                            <th>Tutar</th>

                            <th>Garson</th>

                            <th>Açılış Tarihi</th>

                            <th>Kapanış Tarihi</th>

                        </tr>

                    </thead>

                    <tbody class="category-data-table">

                        <?php foreach ($orders as $index => $value) : ?>

                            <tr>

                                <td><?= $value['table_area'] ?> - <?= $value['table_number'] ?></td>

                                <?php $orderContent = json_decode($value['order_content'], true); ?>

                                <td>

                                    <?php foreach ($orderContent as $val) : ?>

                                       <span><?= $val['product_name'] ?> - <?= $val['amount'] ?> Adet</span><br />

                                    <?php endforeach; ?>

                                </td>

                                <td><?= $value['order_total'] ?></td>

                                <td><?= $value['waiter_name'] ?></td>

                                <td>

                                    <?php

                                    $date = new DateTime($value['table_opening_time']);

                                    $hour = $date->format('H:i');

                                    $date = $date->format('d-m-Y');

                                    echo '<span style="font-size:19px;font-weight:700;color:#FF7F3E;">' . $hour . '</span><br />';

                                    echo $date;

                                    ?>

                                </td>

                                <td>

                                    <?php

                                    $date = new DateTime($value['order_closing_time']);

                                    $hour = $date->format('H:i');

                                    $date = $date->format('d-m-Y');

                                    echo '<span style="font-size:19px;font-weight:700;color:#FF7F3E;">' . $hour . '</span><br />';

                                    echo $date;

                                    ?>

                                </td>

                            </tr>

                        <?php endforeach; ?>

                    </tbody>

                </table>

            </div>

    </main>

    <!-- MAIN END -->

    <script>

        const baseUrl = "<?= $_ENV['BASE_URL'] ?>/";

    </script>

    <script type="module" src="<?= $_ENV['BASE_URL'] ?>/public/js/AdminMain.js"></script>

</body>



</html>