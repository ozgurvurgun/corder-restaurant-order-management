import Formatter from "../../modules/Formatter.js";
import RequestHandler from "../../libs/RequestHandler.js";

export default class TablesOperations {
  constructor() {
    const session = localStorage.getItem("session");
    if (session != "true") {
      alert("Oturum zaman aşımına uğramış.");
      localStorage.setItem("session", "false");
      window.location.href = baseUrl + "login";
    }
    this.formatter = new Formatter();
    this.newOrderButton = document.getElementById("newOrderButton");
    this.returnTableButton = document.getElementById("return-table-button");
    this.closeTableButton = document.getElementById("closeTableButton");
    this.recieptPrintButton = document.getElementById("print-receipt");
    this.returnReceiptsButton = document.getElementById(
      "selected-table-number-of-tickets"
    );
    this.displayUpdate();
    this.clickEventAdder();
  }

  async getReceiptData() {
    const requestHandler = new RequestHandler();
    const tableArea = localStorage.getItem("selected-table-area");
    const tableNumber = localStorage.getItem("selected-table-number");
    const data = [
      { key: "table-area", value: tableArea },
      { key: "table-number", value: tableNumber },
    ];
    return await requestHandler.post(
      "https://fikrininyeri.online/terminal-service/get-receipt",
      data
    );
  }

  async displayUpdate() {
    this.selectedTableArea = localStorage.getItem("selected-table-area");
    this.selectedTableNumber = localStorage.getItem("selected-table-number");
    this.selectedTableSubUsername = localStorage.getItem(
      "selected-sub-username"
    );

    const count = await this.getReceiptData();
    this.selectedTableNumberOfTickets = count.length;
    this.selectedTableTotalAmount = localStorage.getItem(
      "selected-table-total-amount"
    );

    //DISPLAY ELEMENTS
    const selectedTableAreaAndTableNumberElement = document.getElementById(
      "selected-table-area-and-table-number"
    );
    const selectedTableSubUsernameElement = document.getElementById(
      "selected-table-SubUser-name"
    );
    const selectedTableNumberOfTicketsElement = document.getElementById(
      "selected-table-number-of-tickets"
    );
    const selectedTableTotalAmountElement = document.getElementById(
      "selected-table-total-amount"
    );

    //ELEMENT UPDATE
    selectedTableAreaAndTableNumberElement.innerHTML = `<span>${this.selectedTableArea}</span> - <span>#${this.selectedTableNumber}</span>`;
    selectedTableSubUsernameElement.innerHTML = `<i class="fa-solid fa-user"></i>${this.selectedTableSubUsername}`;
    selectedTableNumberOfTicketsElement.innerHTML = `${this.selectedTableNumberOfTickets ?? 0} Adisyon`;
    selectedTableTotalAmountElement.innerHTML = `Hesap ${this.formatter.moneyFormatter(
      this.selectedTableTotalAmount,
      "TRY"
    )}`;
  }

  clickEventAdder() {
    this.newOrderButton.addEventListener("click", () => {
      window.location.href = baseUrl + "terminal-menu";
    });

    this.returnTableButton.addEventListener("click", () => {
      window.location.href = baseUrl + "tables";
    });

    this.returnReceiptsButton.addEventListener("click", () => {
      window.location.href = baseUrl + "receipt";
    });

    this.closeTableButton.addEventListener("click", async () => {
      if (
        confirm(
          `${this.selectedTableArea} - ${this.selectedTableNumber} masasını kapatmak istediğinize emin misiniz?`
        )
      ) {
        if (confirm("Bu işlem geri alınamaz!\nDevam etmek için onaylayın.")) {
          const data = await this.closeTable();
          if (data.status_code == "success") {
            alert(
              `${this.selectedTableArea} - ${this.selectedTableNumber} Kapatıldı.`
            );
            window.location.href = baseUrl + "tables";
          }
        }
      }
    });

    this.recieptPrintButton.addEventListener("click", async () => {
      await this.printTable();
    });
  }

  async printTable() {
    if (this.selectedTableNumberOfTickets == undefined) {
      alert("Masaya ait açık adisyon bulunmuyor.");
      return;
    }
    if (
      !confirm("Eğer devam ederseniz masaya açılan bütün adisyonlar basılır!")
    ) {
      return;
    }
    const requestHandler = new RequestHandler();
    const data = [
      { key: "table-number", value: this.selectedTableNumber },
      { key: "table-area", value: this.selectedTableArea },
    ];

    const response = await requestHandler.post(
      "https://fikrininyeri.online/terminal-service/slip-printing",
      data
    );
    // return response;
    if (response.status_code == "no_order") {
      alert("Masaya ait adisyon bulunmuyor.");
    } else if (response.status_code == "success") {
      alert("Yazdırma isteği gönderildi.");
    }
  }

  async closeTable() {
    const requestHandler = new RequestHandler();
    const data = [
      { key: "table-number", value: this.selectedTableNumber },
      { key: "table-area", value: this.selectedTableArea },
    ];

    const response = await requestHandler.post(
      "https://fikrininyeri.online/terminal-service/close-table",
      data
    );
    return response;
  }
}
