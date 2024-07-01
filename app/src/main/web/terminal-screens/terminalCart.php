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
            height: 47svh;
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
            gap: 20px;
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

        main section>div:last-child div button {
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            font-size: 19px;
            font-weight: 700;
            color: #fff;
            background-color: #F40D5B;
            margin: 0;
            padding: 0;
        }

        .product-amount {
            display: inline-block;
            text-align: center;
            width: 30px;
            font-weight: 700;
            font-size: 18px;
        }

        .product-price {
            color: #D3A0AF;
            font-weight: 600;
            font-size: 17px;
        }

        .cart-total {
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

        footer {
            width: 100%;
            position: absolute;
            bottom: 0;
            margin-bottom: 20px;
        }

        footer button {
            border-radius: 12px;
            width: 100%;
            padding: 15px;
            border: none;
            background: linear-gradient(90deg, #78B766, #1B944D);
            font-size: 16px;
            font-weight: 700;
            color: #fff;
            word-spacing: 3px;
        }

        textarea{
            font-size: 15px;
            margin: 15px 0;
            resize: none;
            width: 100%;
            padding: 5px;
            outline: none;
            border: 1px solid grey;
            border-radius: 5px;
        }
    </style>
</head>

<body tabindex="0">
    <div class="terminal-cart-screen" id="terminal-cart-screen">
        <header class="container">
            <span>
                <i id="back-to-terminal-menu-button" class="fa-solid fa-arrow-right-to-bracket"></i>
                <h1 id="table">Sepet</h1>
            </span>
            <div>
                <button><i class="fa-solid fa-cart-shopping selected-button"></i></button>
                <button id="back-to-receipt-button"><i class="fa-solid fa-receipt"></i></button>
            </div>
        </header>

        <div class="container">
            <h2 id="selected-table" class="table"></h2>
            <main id="cart-content">
            </main>
        </div>

        <div class="container">
            <textarea placeholder="Not varsa buraya..." id="order-note" rows="2"></textarea>
        </div>

        <div class="cart-total container">
            <p>TOPLAM</p>
            <p id="cart-total-amount"></p>
        </div>

        <footer class="container">
            <button id="send-order-button">Siparişi Gönder</button>
        </footer>
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