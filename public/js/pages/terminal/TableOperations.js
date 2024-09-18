import Formatter from "../../modules/Formatter.js";
import RequestHandler from "../../libs/RequestHandler.js";
import PopUp from "../../modules/PopUp.js";

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
    this.returnReceiptsButton = document.getElementById("selected-table-number-of-tickets");

    this.displayUpdate();
    this.clickEventAdder();

    new PopUp("moving-table-wrapper", ["moving-table-button"], ["moving-table-close"], false);
    this.movingTable();
    this.movingTableRequest();
    this.getTablesAreaDisplay();
  }

  async getReceiptData() {
    const requestHandler = new RequestHandler();
    const tableArea = localStorage.getItem("selected-table-area");
    const tableNumber = localStorage.getItem("selected-table-number");
    const data = [
      { key: "table-area", value: tableArea },
      { key: "table-number", value: tableNumber },
    ];

    return await requestHandler.post(baseUrl + "terminal-service/get-receipt", data);
  }

  async displayUpdate() {
    this.selectedTableArea = localStorage.getItem("selected-table-area");
    this.selectedTableNumber = localStorage.getItem("selected-table-number");
    this.selectedTableSubUsername = localStorage.getItem("selected-sub-username");

    const count = await this.getReceiptData();
    this.selectedTableNumberOfTickets = count.length;
    this.selectedTableTotalAmount = localStorage.getItem("selected-table-total-amount");

    //DISPLAY ELEMENTS
    const selectedTableAreaAndTableNumberElement = document.getElementById("selected-table-area-and-table-number");
    const selectedTableSubUsernameElement = document.getElementById("selected-table-SubUser-name");
    const selectedTableNumberOfTicketsElement = document.getElementById("selected-table-number-of-tickets");
    const selectedTableTotalAmountElement = document.getElementById("selected-table-total-amount");

    //ELEMENT UPDATE
    selectedTableAreaAndTableNumberElement.innerHTML = `<span>${this.selectedTableArea}</span> - <span>#${this.selectedTableNumber}</span>`;
    selectedTableSubUsernameElement.innerHTML = `<i class="fa-solid fa-user"></i>${this.selectedTableSubUsername}`;
    selectedTableNumberOfTicketsElement.innerHTML = `${this.selectedTableNumberOfTickets ?? 0} Adisyon`;

    selectedTableTotalAmountElement.innerHTML = `Hesap ${this.formatter.moneyFormatter(
      this.selectedTableTotalAmount,
      "TRY"
    )}`;

    if (this.returnReceiptsButton.innerHTML == "0 Adisyon") {
      document.getElementById("moving-table-button").disabled = true;
      document.getElementById("moving-table-button").style.opacity = "0.9";
      document.getElementById("moving-table-button").style.color = "#F09BBA";
    }
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
            alert(`${this.selectedTableArea} - ${this.selectedTableNumber} Kapatıldı.`);
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

    if (!confirm("Eğer devam ederseniz masaya açılan bütün adisyonlar basılır!")) {
      return;
    }

    const requestHandler = new RequestHandler();

    const data = [
      { key: "table-number", value: this.selectedTableNumber },
      { key: "table-area", value: this.selectedTableArea },
    ];

    const response = await requestHandler.post(baseUrl + "terminal-service/slip-printing", data);

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

    const response = await requestHandler.post(baseUrl + "terminal-service/close-table", data);
    return response;
  }

  movingTable() {
    const selectedTable = document.querySelector(".moving-table-selected-table-area-and-table-number");
    selectedTable.innerHTML = `<span>${this.selectedTableArea}</span> - <span>#${this.selectedTableNumber}</span>`;
  }

  async getTablesArea() {
    const requestHandler = new RequestHandler();
    const response = await requestHandler.post(
      baseUrl + "terminal-service/get-tables-area"
    );

    return response;
  }

  async getTableNumbers(tableArea) {
    const requestHandler = new RequestHandler();

    const data = [
      // { key: "table-area", value: this.selectedTableArea }
      { key: "table-area", value: tableArea },
    ];

    const response = await requestHandler.post(
      baseUrl + "terminal-service/get-table-numbers",
      data
    );

    return response;
  }

  async getTablesAreaDisplay() {
    const tablesAreaData = await this.getTablesArea();
    const tableTypesHeaderElement = document.getElementById("table-areas");
    let display = `<option selected value="string">Bölge</option>`;

    tablesAreaData.forEach((element) => {
      display += `
      <option value="${element.table_area}">${element.table_area}</option>
      `;
    });

    tableTypesHeaderElement.innerHTML = display;
    this.getTableNumbersDisplay();
  }

  async getTableNumbersDisplay() {
    const tableTypesHeaderElement = document.getElementById("table-areas");

    tableTypesHeaderElement.addEventListener("change", async () => {
      const tableData = await this.getTableNumbers(
        tableTypesHeaderElement.value
      );

      const tableNumbers = document.getElementById("table-numbers");

      if (tableData.status_code == "no_session" || tableData == "") {
        tableNumbers.innerHTML = `<option selected value="string">Masa Numarası</option>`;
      }

      let display = `<option selected value="string">Masa Numarası</option>`;

      tableData.forEach((element) => {
        display += `<option value="${element.table_number}">${element.table_number}</option>`;
      });

      tableNumbers.innerHTML = display;
    });
  }

  movingTableRequest() {
    const movingRegisterButton = document.querySelector(".moving-table-register-button");

    movingRegisterButton.addEventListener("click", async () => {
      if (!confirm("Masayı taşımak istediğinize emin misiz?")) {
        return;
      }

      if (!confirm("Bu işlemin geri dönüşü yoktur, lütfen son onayı verin.")) {
        return;
      }

      const requestHandler = new RequestHandler();
      const newTableArea = document.getElementById("table-areas").value;
      const newTableNumber = document.getElementById("table-numbers").value;

      const data = [
        { key: "selected-table-area", value: this.selectedTableArea },
        { key: "selected-table-number", value: this.selectedTableNumber },
        { key: "new-table-area", value: newTableArea },
        { key: "new-table-number", value: newTableNumber },
      ];

      if (newTableArea == "string" || newTableNumber == "string") {
        alert("Seçimi eksiksiz yapın.");
        return;
      }

      const response = await requestHandler.post(
        baseUrl + "terminal-service/moving-table",
        data
      );

      if (response.status_code == "success") {
        alert("Masa taşıma başarılı");

        window.location.href = baseUrl + "tables";
      } else if (response.status_code == "table_is_full") {
        alert("Hedef masa dolu!");
      } else {
        alert("Masa taşıma başarısız");
      }
    });
  }
}
