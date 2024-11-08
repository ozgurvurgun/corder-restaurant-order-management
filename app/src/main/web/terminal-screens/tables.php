<!DOCTYPE html>

<html lang="tr">



<head>

    <meta charset="UTF-8" />

    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />

    <link rel="apple-touch-startup-image" href="<?= $_ENV['BASE_URL'] ?>/public/images/pwa/96x96.png" media="orientation: portrait">

    <link rel="apple-touch-startup-image" href="<?= $_ENV['BASE_URL'] ?>/public/images/pwa/96x96.png" media="orientation: landscape">

    <link rel="manifest" href="<?= $_ENV['BASE_URL'] ?>/manifest.json" />

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />

    <title>Compart Order - Hand Terminal</title>

    <style>

        @import url("https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&display=swap");



        * {

            box-sizing: border-box;

            margin: 0;

            padding: 0;

            font-family: "Nunito", sans-serif;

            text-decoration: none;

        }



        input {

            -webkit-appearance: none;

            -webkit-border-radius: 0px;

        }



        html {

            overscroll-behavior-x: none;

        }



        body {

            touch-action: none;

            height: 100svh;

            width: 100dvw;

            overflow: hidden;

            -webkit-user-select: none;

            /* Safari */

            -moz-user-select: none;

            /* Firefox */

            -ms-user-select: none;

            /* IE 10+ */

            user-select: none;

            /* Standartlar */

        }



        .tables-screen {

            position: relative;

            height: 100%;

            width: 100%;

            margin: auto;

            overflow: hidden;

            transform: scale(3);

            opacity: 0.03;

            transition: opacity 0.5s ease, transform 0.5s ease;

        }



        .tables-screen .container {

            padding: 0 15px;

        }



        .tables-screen header {

            background: linear-gradient(180deg, #FA0352, #E00C5B);

            min-height: 60px;

            padding: 100px;

            display: flex;

            align-items: center;

            justify-content: space-between;

        }



        .tables-screen {

            height: 100%;

            display: flex;

            flex-direction: column;

            background-color: #EBE8F1;

        }



        .tables-screen main {

            overflow-y: auto;

        }



        .tables-screen main::-webkit-scrollbar {

            display: none;

        }



        .tables-screen .table-types-headers {

            width: 100%;

            min-height: 30px;

            overflow-y: hidden;

            display: flex;

            white-space: nowrap;

            overflow-x: auto;

            gap: 50px;

            margin: 15px 0;

            justify-content: space-between;

            color: #959496;

            font-weight: 700;

            font-size: 18px;

        }



        .tables-screen .table-types-headers p.selected {

            color: #F22151;

        }



        .tables-screen .tables-status-button.selected {

            color: #F22151;

        }



        .tables-screen .table-types-headers::-webkit-scrollbar {

            display: none;

        }



        .tables-screen main .tables {

            display: grid;

            gap: 7px;

            grid-template-columns: 1fr 1fr 1fr;

            margin-bottom: 70px;

        }



        .tables-screen main .tables section {

            position: relative;

            aspect-ratio: 1;

            background-color: #fff;

            border-radius: 15px;

        }



        .tables-screen main .tables section::before {

            content: "";

            width: 40%;

            height: 7px;

            background-color: #D4D0DC;

            position: absolute;

            top: 6px;

            border-radius: 10px;

        }



        .tables-screen main .tables .empty-table {

            display: flex;

            flex-direction: column;

            align-items: center;

            justify-content: center;

        }



        .tables-screen main .tables .empty-table .table-id {

            font-size: 16px;

            font-weight: 700;

            color: #434343;

        }



        .tables-screen main .tables .empty-table .table-status {

            color: #959496;

            font-weight: 700;

            font-size: 14px;

        }



        .tables-screen main .tables .full-table {

            background: linear-gradient(180deg, #F02F67, #F12456);

            display: flex;

            flex-direction: column;

            align-items: center;

            justify-content: center;

        }



        .tables-screen main .tables .full-table .table-id {

            font-size: 16px;

            font-weight: 700;

            color: #fff;

        }



        .tables-screen main .tables .full-table .table-status {

            color: #fff;

            font-size: 14px;

        }



        .tables-screen main .tables .full-table .table-meta-data {

            display: flex;

            gap: 8px;

            width: 85%;

            justify-content: space-between;

            position: absolute;

            bottom: 8px;

            font-size: 13px;

            color: #fff;

        }



        .tables-screen main .tables .full-table .table-meta-data span:first-child {

            white-space: nowrap;

            overflow: hidden;

            text-overflow: ellipsis;

        }



        .tables-screen main .tables .reserved-table {

            background: linear-gradient(180deg, #DBA364, #D6967D);

            display: flex;

            flex-direction: column;

            align-items: center;

            justify-content: center;

        }



        .tables-screen main .tables .reserved-table .table-id {

            font-size: 16px;

            font-weight: 700;

            color: #fff;

        }



        .tables-screen main .tables .reserved-table .table-status {

            color: #fff;

            font-weight: 700;

            font-size: 14px;

        }



        .tables-screen main .tables .reserved-table i {

            position: absolute;

            margin-top: 65px;

            color: #fff;

        }



        .tables-screen footer {

            border-top: 1px solid rgba(149, 148, 150, 0.3);

            min-height: 60px;

            display: flex;

            position: absolute;

            width: 100svw;

            bottom: 0;

            align-items: center;

            justify-content: space-between;

            background-color: #fff;

            z-index: 999;

        }



        .tables-screen footer section {

            display: flex;

            flex-direction: column;

            align-items: center;

            color: #959496;

            font-weight: 700;

            font-size: 15px;

        }



        .tables-screen header i {

            color: #fff;

            font-size: 30px;

        }



        .tables-screen header span {

            display: flex;

            gap: 8px;

            align-items: center;

        }



        .tables-screen header span h1 {

            color: #fff;

        }



        @media (min-width: 1100px) {

            .tables-screen main .tables {

                grid-template-columns: 1fr 1fr 1fr 1fr 1fr;

            }

        }

    </style>

</head>



<body tabindex="0">

    <div class="tables-screen" id="tables-screen">

        <header class="container">

            <span>

                <i class="fa-solid fa-bowl-food"></i>

                <h1>Corder</h1>

            </span>

            <i class="fa-solid fa-bars"></i>

        </header>

        <div class="container">

            <div id="table-types-headers" class="table-types-headers">

            </div>

        </div>



        <main class="container">

            <div id="tables" class="tables">

            </div>

        </main>



        <footer class="container">

            <section data-status="all" class="tables-status-button">

                <i class="fa-solid fa-shrimp"></i>

                Tüm Masalar

            </section>

            <section data-status="open" class="tables-status-button">

                <i class="fa-solid fa-champagne-glasses"></i>

                Açık Masalar

            </section>

            <section>

                <i class="fa-solid fa-hashtag"></i>

                Numara Gir

            </section>

        </footer>

    </div>



    <script>

        document.addEventListener("DOMContentLoaded", () => {

            const screen = document.querySelector(".tables-screen");

            setTimeout(() => {

                screen.style.transform = "none";

                screen.style.opacity = "1";

            }, 10);

        });

        const baseUrl = "<?= $_ENV['BASE_URL'] ?>/";

        const systemUserToken = "<?= $_SESSION['system-user-token'] ?>";

    </script>

    <script type="module" src="<?= $_ENV['BASE_URL'] ?>/public/js/TerminalMain.js"></script>

</body>



</html>