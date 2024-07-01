import RequestHandler from "../../libs/RequestHandler.js";
import Formatter from "../../modules/Formatter.js";

export default class Receipt {
  constructor() {
    this.backToPreviousPage();
    this.getReceiptData();
    this.selectedTableDisplay();
    this.formatter = new Formatter();
  }

  backToPreviousPage() {
    const backToTablesButton = document.getElementById(
      "back-to-terminal-menu-button"
    );

    const backToCartButton = document.getElementById("back-to-cart-button");

    backToTablesButton.addEventListener("click", () => {
      window.location.href = baseUrl + "terminal-menu";
    });

    backToCartButton.addEventListener("click", () => {
      window.location.href = baseUrl + "terminal-cart";
    });
  }

  async getReceiptData() {
    const requestHandler = new RequestHandler();
    const tableArea = localStorage.getItem("selected-table-area");
    const tableNumber = localStorage.getItem("selected-table-number");
    const data = [
      { key: "table-area", value: tableArea },
      { key: "table-number", value: tableNumber },
    ];
    const response = await requestHandler.post(
      "https://fikrininyeri.online/terminal-service/get-receipt",
      data
    );

    const receiptDisplay = document.getElementById("receipt-content");
    const receiptIndexWrapper = document.getElementById(
      "receipt-index-wrapper"
    );

    if (response.status_code == "no_receipt") {
      receiptDisplay.innerHTML = "<p>Masaya ait adisyon bulunmuyor.</p>";
      return;
    }

    let receiptContent = "";
    let receiptHeadersIndex = "";
    this.receiptTotalAmount = [];
    this.receiptWaiterName = [];

    response.forEach((order, index) => {
      const orderContent = JSON.parse(order.order_content);
      receiptHeadersIndex += `<p data-index="${
        index + 1
      }" class="receipt-index">${index + 1}</p>`;

      this.receiptTotalAmount.push(order.order_total);
      this.receiptWaiterName.push(order.waiter_name);

      orderContent.forEach((item) => {
        receiptContent += `
             <section class="receipt-content" data-index="${index + 1}">
                    <div>
                        <p>${item.product_name}</p>
                    </div>
                    <div>
                       <span class="product-price">${this.formatter.moneyFormatter(
                         item.product_price,
                         "TRY"
                       )}</span>
                        <div>
                            <span class="product-amount">${
                              item.amount
                            } Adet</span>
                        </div>
                    </div>
            </section>
            `;
      });
    });
    receiptDisplay.innerHTML = receiptContent;
    receiptIndexWrapper.innerHTML = receiptHeadersIndex;

    this.receiptClickEventAdder();
  }

  receiptClickEventAdder() {
    const buttons = document.querySelectorAll(".receipt-index");
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const index = button.dataset.index;
        this.showReceipt(index);
        this.highlightSelectedButton(button);

        const receiptWaiter = document.getElementById("receipt-waiter");
        receiptWaiter.innerHTML = this.receiptWaiterName[index - 1];
        const receiptTotalAmountDisplay = document.getElementById(
          "receipt-total-amount"
        );
        receiptTotalAmountDisplay.innerHTML = this.formatter.moneyFormatter(
          this.receiptTotalAmount[index - 1],
          "TRY"
        );
      });
    });
    buttons[0].click();
  }

  showReceipt(index) {
    const receipts = document.querySelectorAll(".receipt-content");
    receipts.forEach((element) => {
      if (element.getAttribute("data-index") == index) {
        element.style.display = "";
      } else {
        element.style.display = "none";
      }
    });
  }

  highlightSelectedButton(selectedButton) {
    const buttons = document.querySelectorAll(".receipt-index");
    buttons.forEach((button) => {
      if (button === selectedButton) {
        button.classList.add("selected-receipt");
      } else {
        button.classList.remove("selected-receipt");
      }
    });
  }

  selectedTableDisplay() {
    let tableElement = document.getElementById("selected-table");
    tableElement.innerHTML = `${localStorage.getItem(
      "selected-table-area"
    )} - ${localStorage.getItem("selected-table-number")}`;
  }
}
