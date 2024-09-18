import RequestHandler from "../../libs/RequestHandler.js";

import Formatter from "../../modules/Formatter.js";

import Cart from "../../modules/Cart.js";

export default class TerminalUsers {
  constructor() {
    this.formatter = new Formatter();

    this.cart = new Cart();

    this.domElementDefinitions();

    this.generalPageDisplay();

    this.initialize();

    this.sendOrder();

    this.backToPreviousPage();
  }

  async initialize() {
    await this.cartUiUpdate();

    this.cartTotalAmount();
  }

  backToPreviousPage() {
    const backToTablesButton = document.getElementById(
      "back-to-terminal-menu-button"
    );

    const backToReceiptButton = document.getElementById(
      "back-to-receipt-button"
    );

    backToTablesButton.addEventListener("click", () => {
      window.location.href = baseUrl + "terminal-menu";
    });

    backToReceiptButton.addEventListener("click", () => {
      window.location.href = baseUrl + "receipt";
    });
  }

  domElementDefinitions() {
    this.selectedTable = document.getElementById("selected-table");

    this.cartContent = document.getElementById("cart-content");

    this.sendOrderButton = document.getElementById("send-order-button");
  }

  generalPageDisplay() {
    const table = `${localStorage.getItem(
      "selected-table-area"
    )} - ${localStorage.getItem("selected-table-number")}`;

    this.selectedTable.innerHTML = table;
  }

  async cartUiUpdate() {
    const cart = await JSON.parse(localStorage.getItem("cart"));

    let content = "";

    cart.forEach((element) => {
      content += `

        <section>

            <div>

                <p>${element.product_name}</p>

            </div>

            <div>

              <span class="product-price">${this.formatter.moneyFormatter(
                element.product_price,

                "TRY"
              )}

              </span>

                  <div>

                      <button data-product-id="${
                        element.id
                      }" class="increase-button"><i class="fa-solid fa-plus"></i></button>

                      <span class="product-amount">${element.amount}</span>

                      <button data-product-id="${
                        element.id
                      }" class="decrease-button"><i class="fa-solid fa-minus"></i></button>

                  </div>

            </div>

        </section>

      `;
    });

    this.cartContent.innerHTML = content;

    this.increaseButtons = document.querySelectorAll(".increase-button");

    this.decreaseButtons = document.querySelectorAll(".decrease-button");

    this.increaseTheAmountClickEventUpdate();

    this.decreaseTheAmountClickEventUpdate();
  }

  increaseTheAmountClickEventUpdate() {
    this.increaseButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const productId = button.getAttribute("data-product-id");

        this.cart.addToCart({
          id: productId,

          product_name: "",

          product_price: "",
        });

        this.cartUiUpdate();

        this.cartTotalAmount();
      });
    });
  }

  decreaseTheAmountClickEventUpdate() {
    this.decreaseButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const productId = button.getAttribute("data-product-id");

        this.cart.removeFromCart(productId);

        this.cartUiUpdate();

        this.cartTotalAmount();
      });
    });
  }

  sendOrder() {
    this.sendOrderButton.addEventListener("click", async () => {
      const result = await this.sendProductData();

      if (result.status_code == "no_session") {
        alert("Oturum zaman aşımına uğramış.");

        localStorage.removeItem("selected-sub-username");

        localStorage.removeItem("selected-table-number");

        localStorage.removeItem("session");

        localStorage.removeItem("selected-table-area");

        window.location.href = baseUrl + "login";
      } else if (result.status_code == "success") {
        localStorage.setItem("cart", JSON.stringify([]));

        alert("Sipariş başarı ile verildi.");

        window.location.href = baseUrl + "tables";
      }
    });
  }

  async sendProductData() {
    const requestHandler = new RequestHandler();

    const cart = localStorage.getItem("cart");

    const tableArea = localStorage.getItem("selected-table-area");

    const tableNumber = localStorage.getItem("selected-table-number");

    const amount = localStorage.getItem("selected-table-total-amount");

    const waiter = localStorage.getItem("selected-sub-username");

    const note = document.getElementById("order-note").value;

    const data = [
      { key: "cart", value: cart },

      { key: "note", value: note },

      { key: "table-area", value: tableArea },

      { key: "table-number", value: tableNumber },

      { key: "amount", value: amount },

      { key: "waiter", value: waiter },
    ];

    return await requestHandler.post(
      baseUrl + "terminal-service/order-registration",

      data
    );
  }

  cartTotalAmount() {
    const cart = JSON.parse(localStorage.getItem("cart"));

    let result = 0;

    cart.forEach((element) => {
      result += element.product_price * element.amount;
    });

    localStorage.setItem("selected-table-total-amount", result);

    const sendorderButton = document.getElementById("send-order-button");

    const cartTotalAmountElement = document.getElementById("cart-total-amount");

    cartTotalAmountElement.innerHTML = this.formatter.moneyFormatter(
      result,

      "TRY"
    );

    if (result < 1) {
      sendorderButton.disabled = true;

      sendorderButton.style.opacity = "0.5";
    } else {
      sendorderButton.disabled = false;

      sendorderButton.style.opacity = "1";
    }
  }
}
