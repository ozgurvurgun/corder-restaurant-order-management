<!DOCTYPE html>
<html lang="tr">

<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <link rel="apple-touch-startup-image" href="<?= $_ENV['BASE_URL'] ?>public/images/pwa/96x96.png" media="orientation: portrait">
    <link rel="apple-touch-startup-image" href="<?= $_ENV['BASE_URL'] ?>public/images/pwa/96x96.png" media="orientation: landscape">
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

        html {
            overflow: hidden;
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

        .terminal-menu-screen {
            position: relative;
            height: 100%;
            width: 100%;
            margin: auto;
            overflow: hidden;
            transform: scale(3);
            opacity: 0.03;
            transition: opacity 0.5s ease, transform 0.5s ease;
            display: flex;
            flex-direction: column;
            background-color: #EBE8F1;
        }

        .terminal-menu-screen .container {
            padding: 0 15px;
        }

        .terminal-menu-screen header {
            background: linear-gradient(180deg, #FA0352, #E00C5B);
            min-height: 60px;
            padding: 100px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .terminal-menu-screen header i {
            color: #fff;
            font-size: 30px;
        }

        .terminal-menu-screen header span {
            display: flex;
            gap: 20px;
            align-items: center;
        }

        .terminal-menu-screen header span h1 {
            color: #fff;
            font-size: 23px;
            margin-top: 2px;
        }

        .terminal-menu-screen header span:first-child i {
            display: inline-block;
            transform: rotate(180deg);
        }

        .terminal-menu-screen header span:last-child {
            position: relative;
            display: block;
            width: max-content;
        }

        .terminal-menu-screen header span:last-child div.blink {
            position: absolute;
            right: -5px;
            top: -5px;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background-color: #FFBB1C;
        }

        .blink {
            animation: blink 1s infinite;
        }

        @keyframes blink {

            0%,
            100% {
                opacity: 1;
            }

            50% {
                opacity: 0;
            }
        }

        .terminal-menu-screen main {
            overflow-y: auto;
            margin-bottom: 15px;
        }

        .terminal-menu-screen main::-webkit-scrollbar {
            display: none;
        }

        .terminal-menu-screen .food-category-headers {
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

        .terminal-menu-screen .food-category-headers p.selected {
            color: #F22151;
        }

        .terminal-menu-screen .food-category-headers::-webkit-scrollbar {
            display: none;
        }

        .terminal-menu-screen main .products {
            display: grid;
            gap: 12px;
            grid-template-columns: 1fr 1fr 1fr;
            margin-bottom: 15px;
        }

        .terminal-menu-screen main .products section {
            padding: 7px;
            position: relative;
            aspect-ratio: 0.6;
            background-color: #fff;
            border-radius: 15px;
            overflow: hidden;
        }

        .terminal-menu-screen main .products section img {
            width: 100%;
            aspect-ratio: 1.2;
            border-radius: 8px;
        }

        .terminal-menu-screen main .products section p {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 3;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.2em;
            max-height: 4em;
            white-space: normal;
            font-weight: 600;
            font-size: 0.9em;
        }

        .terminal-menu-screen main .products section span {
            color: #F22151;
            font-weight: 700;
            position: absolute;
            bottom: 10px;
        }


        /* responsive start */

        @media (min-width: 450px) {
            .terminal-menu-screen main .products section {
                aspect-ratio: 0.65;
            }
        }

        @media (min-width: 500px) {
            .terminal-menu-screen main .products section {
                aspect-ratio: 0.7;
            }
        }

        @media (min-width: 550px) {
            .terminal-menu-screen main .products section {
                aspect-ratio: 0.73;
            }
        }

        @media (min-width: 1100px) {
            .terminal-menu-screen main .products {
                grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
            }
        }
    </style>
</head>

<body tabindex="0">
    <div class="terminal-menu-screen" id="terminal-menu-screen">
        <header class="container">
            <span>
                <i id="back-to-table-button" class="fa-solid fa-arrow-right-to-bracket"></i>
                <h1 id="table"></h1>
            </span>
            <span>
                <div id="cart-blink"></div>
                <a href="<?= $_ENV['BASE_URL'] ?>terminal-cart"><i class="fa-solid fa-cart-shopping"></i></a>
            </span>
        </header>
        <div id="food-categories-container" class="container">
            <div id="food-categories" class="food-category-headers">
            </div>
        </div>
        <main class="container">
            <div id="products" class="products">
            </div>
        </main>
    </div>

    <script>
        document.addEventListener("DOMContentLoaded", () => {
            const screen = document.querySelector(".terminal-menu-screen");
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