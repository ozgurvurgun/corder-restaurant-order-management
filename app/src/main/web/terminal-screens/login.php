<!DOCTYPE html>

<html lang="tr">



<head>

    <meta charset="UTF-8" />

    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />

    <link rel="apple-touch-startup-image" href="<?= $_ENV['BASE_URL'] ?>/public/images/pwa/96x96.png">

    <link rel="manifest" href="<?= $_ENV['BASE_URL'] ?>/manifest.json" />

    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />

    <title>Compart Order - Hand Terminal</title>

    <!-- REDIRECT START -->

    <script>
        if (localStorage.getItem("session") == "true") {

            window.location.href = "<?= $_ENV['BASE_URL'] ?>/terminal-users";

        }
    </script>

    <!-- REDIRECT END -->

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



        .login-screen {

            position: relative;

            height: 100%;

            width: 80%;

            margin: auto;

            overflow: hidden;

            transform: scale(3);

            opacity: 0.03;

            transition: opacity 0.5s ease, transform 0.5s ease;

        }



        .login-screen .logo {

            margin-top: 55px;

            display: flex;

            flex-direction: column;

            justify-content: center;

            align-items: center;

        }



        .login-screen .logo i {

            font-size: 50px;

            /* color: #FBD85D; */

            color: #F0EBE3;

        }



        .login-screen .logo h2 {

            font-size: 22px;

            color: #F0EBE3;

            margin-top: 15px;

            font-weight: 700;

            text-align: center;

        }



        .login-screen form {

            margin-top: 50px;

            display: flex;

            flex-direction: column;

            gap: 35px;

        }



        .login-screen form input {

            text-align: center;

            background-color: transparent;

            padding: 10px;

            outline: none;

            border: none;

            color: #B5C0D0;

            font-size: 17px;

            border-bottom: 1px solid #B5C0D0;

        }



        .login-screen form input::placeholder {

            color: #B5C0D0;

        }



        .login-screen form button {

            background-color: #F40E59;

            border-radius: 8px;

            color: #F0EBE3;

            padding: 10px;

            border: none;

            font-weight: 600;

            margin-top: 25px;

            font-size: 14px;

        }



        .login-screen footer {

            position: absolute;

            width: 100%;

            text-align: center;

            bottom: 15px;

        }



        .login-screen i {

            font-size: 17px;

            color: #F0EBE3;

        }



        .login-screen a {

            margin-top: 50px;

            display: flex;

            gap: 7px;

            justify-content: center;

            align-items: center;

            font-size: 16px;

            font-weight: 600;

            color: #F0EBE3;

        }



        .login-screen footer p {

            font-size: 14px;

            font-weight: 600;

            color: #F0EBE3;

        }



        .login-screen footer h1 {

            font-size: 17px;

            color: #F0EBE3;

            font-weight: 800;

        }
    </style>

</head>



<body tabindex="0">

    <div class="login-screen" id="login-screen">

        <div class="logo">

            <i class="fa-solid fa-utensils"></i>

            <h2>Corder Terminal</h2>

        </div>

        <form>

            <input type="email" id="system-user-email" placeholder="e-posta" />

            <input type="password" id="system-user-password" placeholder="parola" />

            <button id="systemUserLoginButton" type="button">Giriş Yap</button>

        </form>

        <a href="tel:+905529367951"><i class="fa-solid fa-phone"></i> Müşteri Hizmetleri</a>

        <footer>

            <p>Powered By</p>

            <h1>COMPART SOFTWARE</h1>

        </footer>

    </div>

    <script>
        if ("serviceWorker" in navigator) {

            window.addEventListener("load", function() {

                navigator.serviceWorker

                    .register("<?= $_ENV['BASE_URL'] ?>/serviceWorker.js")

                    .then((res) => console.log("service worker registered"))

                    .catch((err) => console.log("service worker not registered", err));

            });

        }
    </script>

    <script>
        document.addEventListener("DOMContentLoaded", () => {

            const screen = document.querySelector(".login-screen");

            setTimeout(() => {

                screen.style.transform = "none";

                screen.style.opacity = "1";

            }, 10);

        });

        const baseUrl = "<?= $_ENV['BASE_URL'] ?>/";
    </script>

    <script type="module" src="<?= $_ENV['BASE_URL'] ?>/public/js/TerminalMain.js"></script>

</body>



</html>