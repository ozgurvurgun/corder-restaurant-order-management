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
    <title>Corder | Z Raporu</title>
</head>

<body>
    <!-- SIDEBAR START -->
    <nav class="unprintable">
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
                <li>
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
                <li class="active">
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
        main {}

        iframe {
            border: 2px solid #686D76;
            border-radius: 10px;
        }

        /* .example-print {
            display: none;
        } */

        @media print {
            .unprintable {
                display: none;
            }

            .printable {
                display: block;
            }

            main {
                margin-left: 0px;
                padding: 0px;
            }
        }
    </style>
    <main>
        <div class="printable">
            Tarih/Saat: 19-06-2024 05:23:12<br />
            Fiş Tipi: Z<br /><br />


            SİPARİŞ<br /><br />

            _____________________________________<br />
            Miktar Birim Fiyat Ürün<br />
            ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾<br />
            1 ₺200.00 kahvaltı tabağı<br />


            <br /><br />
            _____________________________________<br />
            Toplam: ₺200.00<br />
            ‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾<br />

            7. Bölük Fikrinin Yeri
        </div>

        <button class="unprintable" onclick="window.print();">BAS</button>
    </main>
    <!-- MAIN END -->
    <script>
        const baseUrl = "<?= $_ENV['BASE_URL'] ?>";
    </script>
    <script type="module" src="<?= $_ENV['BASE_URL'] ?>public/js/AdminMain.js"></script>
</body>

</html>