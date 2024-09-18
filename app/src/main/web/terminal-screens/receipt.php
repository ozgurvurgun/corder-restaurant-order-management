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

        .terminal-cart-screen {
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

        .terminal-cart-screen .container {
            padding: 0 20px;
        }

        header {
            background: linear-gradient(180deg, #FA0352, #E00C5B);
            min-height: 60px;
            padding: 100px;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        header i {
            color: #fff;
            font-size: 30px;
        }

        header span {
            display: flex;
            gap: 20px;
            align-items: center;
        }

        header div {
            display: flex;
            gap: 25px;
        }

        header div button {
            background: none;
        }

        header div button i.selected-button {
            color: #A3C9AA;
        }

        header span h1 {
            color: #fff;
            font-size: 23px;
            margin-top: 2px;
        }

        header span i {
            display: inline-block;
            transform: rotate(180deg);
        }

        h2 {
            margin: 20px 0;
            font-weight: 800;
        }

        main {
            height: 55svh;
            overflow-y: auto;
        }

        main::-webkit-scrollbar {
            display: none;
        }

        main section {
            display: grid;
            gap: 20px;
            grid-template-columns: 2fr 1fr;
            padding: 15px 0;
        }

        main section:not(:last-child) {
            border-bottom: 1px solid grey;
        }

        main section>div:first-child {
            display: flex;
        }

        main section>div:last-child {
            display: flex;
            flex-direction: column;
            gap: 4px;
            align-items: center;
            justify-content: center;
        }

        main section>div:last-child {
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
        }

        main section>div:last-child div {
            display: flex;
            align-items: center;
        }

        .product-amount {
            display: inline-block;
            text-align: center;
            /* width: 30px; */
            font-weight: 700;
            font-size: 15px;
        }

        .product-price {
            color: #D3A0AF;
            font-weight: 600;
            font-size: 17px;
        }

        .cart-total {
            margin-top: 35px;
            text-align: right;
        }

        .cart-total p:first-child {
            font-weight: 700;
            font-size: 14px;
            color: #C40C0C;
        }

        .cart-total p:last-child {
            font-weight: 800;
            font-size: 18px;
        }

        .receipt-index-wrapper {
            background-color: #FFE1E5;
            padding: 5px;
            border-radius: 30px;
            width: 100%;
            min-height: 30px;
            overflow-y: hidden;
            display: flex;
            align-items: center;
            white-space: nowrap;
            overflow-x: auto;
            gap: 20px;
            margin: 15px 0;
            color: #959496;
            font-weight: 700;
            font-size: 18px;
        }

        .receipt-index-wrapper p {
            display: flex;
            align-items: center;
            justify-content: center;
            color: #715055;
            width: 50px;
            padding: 7px 30px;
            cursor: pointer;
            border-radius: 30px;
            transition: 0.2s ease all;
        }


        .receipt-index-wrapper::-webkit-scrollbar {
            display: none;
        }

        .selected-receipt {
            text-align: center;
            background-color: #F22151;
            color: #fff !important;
            border-radius: 30px;
        }

        .receipt-meta-data {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .receipt-waiter-wrapper{
            display: flex;
            align-items: center;
            gap: 8px;
            color: #63434E;
            text-transform: capitalize;
        }

        .receipt-waiter-wrapper i{
            font-size: 15px;
        }

        #selected-table{
            font-size: 22;
        }

        #receipt-waiter{
            font-size: 19px;
            font-weight: 600;
        }
    </style>
</head>

<body tabindex="0">
    <div class="terminal-cart-screen" id="terminal-cart-screen">
        <header class="container">
            <span>
                <i id="back-to-terminal-menu-button" class="fa-solid fa-arrow-right-to-bracket"></i>
                <h1 id="table"> <a href="<?= $_ENV['BASE_URL'] ?>adisyonlar"></a> Adisyonlar</h1>
            </span>
            <div>
                <button id="back-to-cart-button"><i class="fa-solid fa-cart-shopping"></i></button>
                <button> <i class="fa-solid fa-receipt selected-button"></i></button>
            </div>
        </header>

        <div class="container">
            <div class="receipt-meta-data">
                <h2 id="selected-table" class="table"></h2>
                <div class="receipt-waiter-wrapper">
                    <i class="fas fa-user"></i>
                    <p id="receipt-waiter"></p>
                </div>
            </div>

            <div id="receipt-index-wrapper" class="receipt-index-wrapper">
            </div>

            <main id="receipt-content">
            </main>
        </div>

        <div class="cart-total container">
            <p>TOPLAM</p>
            <p id="receipt-total-amount"></p>
        </div>
    </div>

    <script>
        document.addEventListener("DOMContentLoaded", () => {
            const screen = document.querySelector(".terminal-cart-screen");
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