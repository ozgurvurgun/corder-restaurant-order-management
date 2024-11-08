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



        body {

            /* overscroll-behavior-y: contain; */

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



        .users-screen {

            position: relative;

            height: 100%;

            width: 80%;

            margin: auto;

            overflow: hidden;

            transform: scale(3);

            opacity: 0.03;

            transition: opacity 0.5s ease, transform 0.5s ease;

        }



        .users-screen>h1 {

            text-align: center;

            font-size: 23px;

            margin-top: 40px;

            color: #fff;

        }



        .users-screen .users-wrapper {

            height: 400px;

            overflow-y: auto;

            width: 100%;

            margin-top: 35px;

        }



        .users-screen .users-wrapper::-webkit-scrollbar {

            display: none;

        }



        .users-screen .users-wrapper .users-list li {

            margin-bottom: 15px;

        }



        .users-screen .users-wrapper .users-list button {

            border: none;

            border-radius: 17px;

            background: rgba(0, 0, 0, 0.19);

            backdrop-filter: blur(10px);

            -webkit-backdrop-filter: blur(10px);

            /* Safari */

            padding: 15px 20px;

            height: 70px;

            width: 100%;

            display: flex;

            align-items: center;

            justify-content: space-between;

        }



        .users-screen .users-wrapper .users-list button i {

            color: #fff;

            font-size: 17px;

        }



        .users-screen .users-wrapper .users-list div {

            display: flex;

            gap: 17px;

            align-items: center;

        }



        .users-screen .users-wrapper .users-list div span {

            font-size: 16px;

            font-weight: 600;

            color: #fff;

        }



        .users-screen .users-wrapper .users-list img {

            border-radius: 50%;

            width: 40px;

            height: 40px;

        }



        .users-screen footer {

            position: absolute;

            width: 100%;

            text-align: center;

            bottom: 15px;

        }



        .users-screen footer p {

            font-size: 14px;

            font-weight: 600;

            color: #F0EBE3;

        }



        .users-screen footer h1 {

            font-size: 17px;

            color: #F0EBE3;

            font-weight: 800;

        }

    </style>

</head>



<body tabindex="0">

    <div class="users-screen" id="users-screen">



        <h1>Kullanıcı Seçin</h1>



        <div class="users-wrapper">

            <ul id="sub-user-list" class="users-list">

            </ul>

        </div>

        <footer>

            <p>Powered By</p>

            <h1>COMPART SOFTWARE</h1>

        </footer>

    </div>



    <script>

        document.addEventListener("DOMContentLoaded", () => {

            const screen = document.querySelector(".users-screen");

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