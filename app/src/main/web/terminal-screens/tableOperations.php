<!DOCTYPE html>
<html lang="tr">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="apple-touch-startup-image" href="<?= $_ENV['BASE_URL'] ?>public/images/pwa/96x96.png">
    <link rel="manifest" href="<?= $_ENV['BASE_URL'] ?>manifest.json" />
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

        body {
            touch-action: none;
            height: 100svh;
            width: 100dvw;
            background: linear-gradient(180deg, #fb0251, #543b8d);
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

        button,
        input[type="button"],
        input[type="submit"] {
            -webkit-appearance: none;
            -moz-appearance: none;
            appearance: none;
            margin: 0;
            padding: 0;
            border: none;
            /* background: none; */
            font-family: inherit;
            font-size: inherit;
            color: inherit;
        }

        button:focus,
        input[type="button"]:focus,
        input[type="submit"]:focus {
            outline: none;
        }


        .table-operations-screen {
            position: relative;
            height: 100%;
            width: 80%;
            margin: auto;
            overflow: hidden;
            transform: scale(3);
            opacity: 0.03;
            transition: opacity 0.5s ease, transform 0.5s ease;
        }


        .table-operations-screen footer {
            position: absolute;
            width: 100%;
            text-align: center;
            bottom: 15px;
        }

        .table-operations-screen .table-meta-data {
            display: flex;
            flex-direction: column;
            gap: 5px;
            align-items: center;
            color: #fff;
            margin-top: 70px;
        }

        .table-operations-screen .table-meta-data h1 {
            font-size: 24px;
        }

        .table-operations-screen .table-meta-data p {
            font-size: 20px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 20px;
        }

        .table-operations-screen .table-meta-data p i {
            font-size: 13px;
            margin-right: 6px;
        }

        .table-operations-screen .table-meta-data p span {
            display: flex;
            align-items: center;
        }

        .table-operations-screen .table-meta-data code {
            font-weight: 600;
            margin-top: 15px;
            font-size: 20px;
            display: flex;
            gap: 20px;
        }

        .table-operations-screen .table-operation-buttons {
            margin-top: 30px;
            display: flex;
            align-items: center;
            flex-direction: column;
            gap: 20px;
            border-radius: 0px;
        }

        .table-operations-screen .table-operation-buttons button {
            display: flex;
            gap: 10px;
            align-items: center;
            border-radius: 40px;
            font-size: 20px;
            font-weight: 600;
            padding: 10px;
            width: 180px;
            color: #F40E59;
        }

        .table-operations-screen .table-operation-buttons button i {
            font-size: 20px;
            color: #F7A8C2;
        }

        .table-operations-screen a {
            -webkit-tap-highlight-color: transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
            margin-top: 55px;
            color: #fff;
            font-size: 20px;
            font-weight: 600;
        }

        .table-operations-screen a i {
            margin-right: 10px;
            font-size: 25px;
        }



        .table-operations-screen footer p {
            font-size: 14px;
            font-weight: 600;
            color: #F0EBE3;
        }

        .table-operations-screen footer h1 {
            font-size: 17px;
            color: #F0EBE3;
            font-weight: 800;
        }
    </style>
</head>

<body tabindex="0">
    <div class="table-operations-screen" id="table-operations-screen">
        <div class="table-meta-data">
            <h1 id="selected-table-area-and-table-number"></h1>
            <p>
                <span id="selected-table-SubUser-name"></span>
                <span id="selected-table-number-of-tickets"></span>
            </p>
            <code id="selected-table-total-amount"></code>
        </div>

        <div class="table-operation-buttons">
            <button id="newOrderButton"><i class="fa-solid fa-circle-plus"></i>Yeni Adisyon</button>
            <button id="closeTableButton"><i class="fa-solid fa-share"></i>Masayı Kapat</button>
            <button id="print-receipt"><i class="fa-solid fa-print"></i>Yazdır</button>
        </div>

        <a id="return-table-button"><i class="fa-solid fa-arrow-left"></i>Masalara Dön</a>
        <footer>
            <p>Powered By</p>
            <h1>COMPART SOFTWARE</h1>
        </footer>
    </div>

    <script>
        document.addEventListener("DOMContentLoaded", () => {
            let screen = document.querySelector(".table-operations-screen");
            let baseUrl = "<?= $_ENV['BASE_URL'] ?>";
            let systemUserToken = `<?= $_SESSION['system-user-token'] ?>`;
            setTimeout(() => {
                screen.style.transform = "none";
                screen.style.opacity = "1";
            }, 10);
        });
        const baseUrl = "<?= $_ENV['BASE_URL'] ?>";
        const systemUserToken = "<?= $_SESSION['system-user-token'] ?>";
    </script>
    <script type="module" src="<?= $_ENV['BASE_URL'] ?>public/js/TerminalMain.js"></script>
</body>

</html>