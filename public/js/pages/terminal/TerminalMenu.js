import RequestHandler from "../../libs/RequestHandler.js";

import Formatter from "../../modules/Formatter.js";

import Cart from "../../modules/Cart.js";

import Scroll from "../../modules/Scroll.js";

export default class TerminalMenu {
  constructor() {
    this.formatter = new Formatter();

    this.cart = new Cart();

    this.productDataDisplay();

    this.backToPreviousPage();

    this.selectedTableDisplay();

    this.initialize();

    let cart = localStorage.getItem("cart");

    if (cart) {
      let parsedCart = JSON.parse(cart);

      if (parsedCart.length > 0) {
        document.getElementById("cart-blink").classList.add("blink");
      }
    }

    const scroll = new Scroll(
      document.querySelector("#food-categories-container"),

      document.querySelector("#food-categories"),

      1
    );
  }

  async initialize() {
    await this.categoryDataDisplay();

    await document.querySelectorAll(".category-item")[0].click();
  }

  backToPreviousPage() {
    const backToTablesButton = document.getElementById("back-to-table-button");

    backToTablesButton.addEventListener("click", () => {
      window.location.href = baseUrl + "tables";
    });
  }

  selectedTableDisplay() {
    let tableElement = document.getElementById("table");

    tableElement.innerHTML = `${localStorage.getItem(
      "selected-table-area"
    )} - ${localStorage.getItem("selected-table-number")}`;
  }

  async getProductData() {
    const requestHandler = new RequestHandler();

    const response = await requestHandler.post(
      baseUrl + "terminal-service/get-products"
    );

    return response;
  }

  async getCategoryData() {
    const requestHandler = new RequestHandler();

    const response = await requestHandler.post(
      baseUrl + "terminal-service/get-categories"
    );

    return response;
  }

  async categoryDataDisplay() {
    const categoryData = await this.getCategoryData();

    if (categoryData.status_code == "no_session") {
      alert("Oturum zaman aşımına uğramış.");

      localStorage.setItem("session", "false");

      window.location.href = baseUrl + "login";
    }

    const categoriesElement = document.getElementById("food-categories");

    let content = "";

    categoryData.forEach((element) => {
      content += `

        <p data-id="${element.name}" class="category-item">${element.name}</p>

        `;
    });

    categoriesElement.innerHTML = content;

    this.categoryClickEventAdder();

    document.querySelectorAll(".category-item")[0].click();

    setTimeout(() => {
      document.querySelectorAll(".category-item")[0].click();
    }, 30);
  }

  categoryClickEventAdder() {
    const buttons = document.querySelectorAll(".category-item");

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const id = button.dataset.id;

        this.showProduct(id);

        this.highlightSelectedButton(button);
      });
    });
  }

  showProduct(selectedCategory) {
    const products = document.querySelectorAll(".product-item");

    products.forEach((product) => {
      if (product.getAttribute("data-category-name") == selectedCategory) {
        product.style.display = "unset";
      } else {
        product.style.display = "none";
      }
    });
  }

  highlightSelectedButton(selectedButton) {
    const buttons = document.querySelectorAll(".category-item");

    buttons.forEach((button) => {
      if (button === selectedButton) {
        button.classList.add("selected");
      } else {
        button.classList.remove("selected");
      }
    });
  }

  async productDataDisplay() {
    const productData = await this.getProductData();

    const productsElement = document.getElementById("products");

    let content = "";

    productData.forEach((element) => {
      content += `

            <section class="product-item"

                data-product-name="${element.name}"

                data-category-name="${element.category}"

                data-product-price="${element.price}"

                data-product-id="${element.id}"

            >

                <img src="${baseUrl}${
        element.image_path
      }?cache-timestamp=${new Date()

        .toLocaleDateString("tr-TR")

        .replace(/\./g, "-")}">

                <p>${element.name}</p>

                <span>${this.formatter.moneyFormatter(
                  element.price,

                  "TRY"
                )}</span>

            </section>

        `;
    });

    productsElement.innerHTML = content;

    this.clickEventAdder();
  }

  clickEventAdder() {
    const buttons = document.querySelectorAll(".product-item");

    buttons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();

        this.clickAnimation(button);

        const productId = button.getAttribute("data-product-id");

        const productPrice = button.getAttribute("data-product-price");

        const productName = button.getAttribute("data-product-name");

        document.getElementById("cart-blink").classList.add("blink");

        this.cart.addToCart({
          id: productId,

          product_name: productName,

          product_price: productPrice,
        });

        const cart = JSON.parse(localStorage.getItem("cart"));

        let result = 0;

        cart.forEach((element) => {
          result += element.product_price * element.amount;
        });

        localStorage.setItem("selected-table-total-amount", result);
      });
    });
  }

  clickAnimation(button) {
    button.style.border = "3px solid #FEBB1B";

    setTimeout(() => {
      button.style.border = "unset";
    }, 50);
  }
}
