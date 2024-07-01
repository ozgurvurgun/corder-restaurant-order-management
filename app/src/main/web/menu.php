<!DOCTYPE html>
<html lang="tr">

<head>
    <meta charset="UTF-8" />
    <!-- <meta name="viewport" content="width=device-width, initial-scale=1.0" /> -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="stylesheet" href="./public/css/menu.css" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
    <link rel="shortcut icon" href="./public/images/ui/logo.jpg" type="image/x-icon">
    <title>Fikrinin yeri</title>
</head>

<body tabindex="0">
    <!-- header start -->
    <div class="header">
        <!-- <div class="bars-icon"><i class="fa-solid fa-bars"></i>&nbsp;Menü&nbsp;</div> -->
        <img loading="lazy" class="logo" src="./public/images/ui/logo.jpg" />
        <div style="position: absolute;left:15px;" class="back-icon">Masa: <?= $_GET['table'] ?></div>
        <div style="position: absolute;right:15px;font-size:38px;"><a style="color:#e0a82f;" target="_blank" href="https://www.instagram.com/7.bolukfikrininyeribeach/"><i class="fa-brands fa-instagram"></i></a></div>
    </div>
    <!-- header end -->
    <div class="catchword">Kategoriler</div>

    <!-- categories start -->
    <div class="container">
        <div class="categories">
            <?php foreach ($categoryData as $value) : ?>
                <div class="category-item" data-category-name="<?= $value['name'] ?>">
                    <img loading="lazy" class="category-image" src="<?= $_POST['BASE_URL'] ?><?= $value['image_path'] ?>" />
                    <p><?= $value['name'] ?></p>
                </div>
            <?php endforeach; ?>
        </div>
    </div>
    <!-- categories end -->

    <!-- products start -->
    <div class="container">
        <h2 class="product-header"></h2>
        <!-- <p class="product-explanation"> Sweet or salty. we have the perfect breakfast for every taste.</p> -->
        <div class="products" id="products"></div>
    </div>
    <!-- products end -->

    <!-- basket start -->
    <!-- ------------------------------ -->
    <!-- <div class="basket-wrapper">
        <div class="basket" id="basket">
            <i class="fa-solid fa-basket-shopping"></i>
            <div class="basket-count-wrapper">
                <span class="basket-count"></span>
            </div>
        </div>
    </div> -->
    <!-- basket end -->

    <!-- card modal start -->
    <div class="popup" id="popup">
        <div class="overlay"></div>
        <div class="popup-content">
            <h2>Sepet</h2>
            <div class="modal-products"></div>
            <div class="subtotal">
                <p class="subtotal-header">Toplam:</p>
                <p class="subtotal-value"><span class="tl"> TL</span></p>
            </div>
            <div class="controls">
                <button class="close-btn">Menüye Dön</button>
                <button class="submit-btn">Siparişi Tamamla</button>
            </div>
        </div>
    </div>
    <!-- card modal end -->


    <style>
        /* The Modal (background) */
        .modal {
            display: block;
            /* Hidden by default */
            position: fixed;
            /* Stay in place */
            z-index: 1;
            /* Sit on top */
            padding-top: 130px;
            padding-left: 20px;
            padding-right: 20px;
            /* Location of the box */
            left: 0;
            top: 0;
            width: 100%;
            /* Full width */
            height: 100%;
            /* Full height */
            overflow: auto;
            /* Enable scroll if needed */
            background-color: rgb(0, 0, 0);
            /* Fallback color */
            background-color: rgba(0, 0, 0, 0.4);
            /* Black w/ opacity */
        }

        /* Modal Content */
        .modal-content {
            border-radius: 10px;
            position: relative;
            text-align: center;
            background-color: #fefefe;
            margin: auto;
            padding: 30px 20px;
            border: 1px solid #888;
            max-width: 400px;
        }

        .modal-content div img {
            width: 100%;
        }

        .modal-content div p {
            margin-top: 15px;
            font-weight: 500;
            font-size: 20px;
        }

        /* The Close Button */
        .close {
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: red;
            color: #fff;
            font-size: 16px;
            font-weight: bold;
            position: absolute;
            right: -15px;
            top: -15px;
        }

        .close:hover,
        .close:focus {
            color: #000;
            text-decoration: none;
            cursor: pointer;
        }
    </style>
    </head>

    <body>

        <!-- The Modal -->
        <div id="myModal" class="modal">

            <!-- Modal content -->
            <div class="modal-content">
                <span class="close"><i class="fa-solid fa-x"></i></span>
                <div>
                    <img src="<?= $_ENV['BASE_URL'] ?>public/images/ui/bira-patates.png">
                    <h2>Kampanya</h2>
                    <p>4 Şişe Efes Malt + Patates Kızartması Sadece ₺500</p>
                </div>
            </div>

        </div>
        <script>
            <?php
            $menuData = [];

            foreach ($productData as $item) {
                $category = $item['category'];
                if (!isset($menuData[$category])) {
                    $menuData[$category] = [];
                }

                $menuData[$category][] = [
                    'id' => $item['id'],
                    'product_name' => $item['name'],
                    'product_price' => $item['price'],
                    'product_picture' => basename($item['image_path']),
                    'active' => $item['status']
                ];
            }
            echo 'const menu_data = ' . json_encode($menuData, true) . ';';
            ?>
            const base_url = "<?= $_ENV['BASE_URL'] ?>";
        </script>
        <script>
            function moneyFormatter(number, currency) {
                const formatter = new Intl.NumberFormat("tr-TR", {
                    style: "currency",
                    currency: currency,
                    minimumFractionDigits: 2,
                });
                const formattedNumber = formatter.format(number);

                return formattedNumber;
            }

            /*** popup start ***/
            function createPopup(id) {
                let popupNode = document.querySelector(id);
                let overlay = popupNode.querySelector(".overlay");
                let closeBtn = popupNode.querySelector(".close-btn");

                function openPopup() {
                    popupNode.classList.add("active");
                }

                function closePopup() {
                    popupNode.classList.remove("active");
                }
                overlay.addEventListener("click", closePopup);
                closeBtn.addEventListener("click", closePopup);
                return openPopup;
            }

            let popup = createPopup("#popup");
            /////////////////////////////////////
            // document.querySelector("#basket").addEventListener("click", popup);
            /*** popup end ***/

            /*** get product start ***/
            const categoryButtons = document.querySelectorAll(".category-item");
            categoryButtons.forEach((button) => {
                button.addEventListener("click", function() {
                    let categoryName = button.getAttribute("data-category-name");
                    if (menu_data.hasOwnProperty(categoryName)) {
                        getProducts(categoryName);
                    } else {
                        document.getElementById("products").style.opacity = "0";
                        document.querySelector(".product-header").style.opacity = "0";
                        setTimeout(function() {
                            document.querySelector(".product-header").innerHTML = categoryName;
                            document.getElementById("products").innerHTML = `<p style="text-align:center">Bu kategoriye ait ürün bulunmuyor.</p>`;
                            document.getElementById("products").style.opacity = "1";
                            document.querySelector(".product-header").style.opacity = "1";
                        }, 150);
                    }
                });
            });
            document.querySelectorAll(".category-item")[0].click();

            function getProducts(categoryName) {
                productDataView = "";
                menu_data[categoryName].forEach((element) => {
                    productDataView += `
            <div class="product-item">
              <img loading="lazy" class="product-image"src="${base_url}public/images/products/${element.product_picture}">
              <div class="product-info">
                <h3 class="product-name">${element.product_name}</h3>
                <p class="product-price">${moneyFormatter(element.product_price, "TRY")}</p>
              </div>
              <!--<button class="btn-add-to-cart" data-product-id="${element.id}"><i class="fa-solid fa-plus"></i></button>-->
            </div>
            `;
                });

                setTimeout(() => {
                    addToCartData(menu_data[categoryName]);
                }, 200);

                document.getElementById("products").style.opacity = "0";
                document.querySelector(".product-header").style.opacity = "0";
                setTimeout(function() {
                    document.querySelector(".product-header").innerHTML = categoryName;
                    document.getElementById("products").innerHTML = productDataView;
                    document.getElementById("products").style.opacity = "1";
                    document.querySelector(".product-header").style.opacity = "1";
                }, 150);
            }
            /*** get product end ***/

            /*** order system start ***/
            const cartBtn = document.querySelector(".basket");
            const cartItems = document.querySelector(".basket-count");
            const cartTotal = document.querySelector(".subtotal-value");
            const cartContent = document.querySelector(".modal-products");

            let cart = [];
            if (localStorage.getItem("cart") != null) {
                cart = JSON.parse(localStorage.getItem("cart"));
                /** So that the basket value is loaded quickly on the first load. **/
                let totalProduct = 0;
                cart.forEach((element) => {
                    totalProduct += Number(element.amount);
                });
                cartItems.innerHTML = totalProduct;
            }

            function addToCartData(productData) {
                const addToCartButtons = [...document.querySelectorAll(".btn-add-to-cart")];
                addToCartButtons.forEach((button) => {
                    button.addEventListener("click", function() {
                        button.disabled = true;
                        let product_id = button.getAttribute("data-product-id");
                        productData.forEach((product) => {
                            if (product.id == product_id) {
                                const indeks = cart.findIndex((product) => product.id == product_id);
                                if (indeks !== -1) {
                                    cart[indeks].amount += 1;
                                } else {
                                    cart.push({
                                        ...product,
                                        amount: 1
                                    });
                                }
                            }
                        });
                        localStorage.setItem("cart", JSON.stringify(cart));
                        uiDraw();
                        setTimeout(() => {
                            button.disabled = false;
                        }, 200);
                    });
                });
            }

            const token = "yh4qLXWcDeoTCqOrUiEXl1qIEp61jsxGyMPejJxQjuxi4PPfEeZ2hDGsIE4e073PcAg5YjSpoAj8xMiaaEvwIi14miy0DFXGs9tUMBpTuQWtme6MfjE2LCs8lhyV7Qf56coWHT8vz1kxJFpkxAs4E2mTtUm8RbVOupXwTV9hWEuRWZ4TOT3dd5VKzX3IfSB9mYb0DIua";

            function uiDraw() {
                let basketDOM = "";
                cart.forEach((element) => {
                    basketDOM += ` 
          <div class="product-item">
             <img loading="lazy" class="product-image" src="${base_url}public/images/products/${element.product_picture}">
             <div class="product-info">
               <h3 class="product-name">${element.product_name}</h3>
               <p class="product-price">${moneyFormatter(element.product_price, "TRY")}</p>
             </div>
             <div class="product-item-right">
               <div class="product-item-right-quantity">
                 <button class="quantity-plus" data-product-id="${element.id}">
                   <i class="fa-solid fa-plus"></i>
                 </button>
                 <span class="quantity">${element.amount}</span>
                 <button class="quantity-minus" data-product-id="${element.id}">
                   <i class="fa-solid fa-minus"></i>
                 </button>
               </div>
             </div>
          </div>
        `;
                });
                cartContent.innerHTML = basketDOM;
                let totalProduct = 0;
                let totalPrice = 0;
                cart.forEach((element) => {
                    totalProduct += Number(element.amount);
                    totalPrice += Number(element.product_price) * Number(element.amount);
                });
                cartItems.innerHTML = totalProduct;
                cartTotal.innerHTML = `${moneyFormatter(totalPrice, "TRY")}`;
                setTimeout(() => {
                    productPlus();
                    productMinus();
                }, 200);
            }

            function productPlus() {
                const quantityPlus = [...document.querySelectorAll(".quantity-plus")];
                quantityPlus.forEach((button) => {
                    button.addEventListener("click", function() {
                        let productID = button.getAttribute("data-product-id");
                        let product = cart.find((item) => item.id == parseInt(productID));
                        if (product) {
                            product.amount += 1;
                        }
                        localStorage.setItem("cart", JSON.stringify(cart));
                        uiDraw();
                    });
                });
            }

            function productMinus() {
                const quantityMinus = [...document.querySelectorAll(".quantity-minus")];
                quantityMinus.forEach((button) => {
                    button.addEventListener("click", function() {
                        let productID = button.getAttribute("data-product-id");
                        let product = cart.find((item) => item.id == parseInt(productID));
                        if (product) {
                            product.amount -= 1;
                            if (product.amount <= 0) {
                                cart = cart.filter((item) => item.id !== product.id);
                            }
                        }
                        localStorage.setItem("cart", JSON.stringify(cart));
                        uiDraw();
                    });
                });
            }

            document.addEventListener("DOMContentLoaded", () => {
                setTimeout(() => {
                    uiDraw();
                }, 500);
            });
            /*** order system end ***/
        </script>
        <script>
            // Get the modal
            var modal = document.getElementById("myModal");

            // Get the button that opens the modal


            // Get the <span> element that closes the modal
            var span = document.getElementsByClassName("close")[0];

            // When the user clicks the button, open the modal 

            // When the user clicks on <span> (x), close the modal
            span.onclick = function() {
                modal.style.display = "none";
            }

            // When the user clicks anywhere outside of the modal, close it
            window.onclick = function(event) {
                if (event.target == modal) {
                    modal.style.display = "block";
                }
            }
        </script>
    </body>

</html>