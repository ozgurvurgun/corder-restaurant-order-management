import RequestHandler from "../libs/RequestHandler.js";
import Formatter from "./Formatter.js";

export default class TableManagement {
  constructor() {
    this.selectedTableArea = "";
    this.formatter = new Formatter();
  }
  async getTables() {
    const requestHandler = new RequestHandler();
    const response = await requestHandler.post(
      "https://site.com/terminal-service/get-tables"
    );
    return response;
  }

  async getTablesArea() {
    const requestHandler = new RequestHandler();
    const response = await requestHandler.post(
      "https://site.com/terminal-service/get-tables-area"
    );
    return response;
  }

  async getTablesAreaDisplay() {
    const tablesAreaData = await this.getTablesArea();
    const tableTypesHeaderElement = document.getElementById(
      "table-types-headers"
    );
    let display = `<p class="table-area">Tümü</p>`;
    tablesAreaData.forEach((element) => {
      display += `<p class="table-area">${element.table_area}</p>`;
    });

    tableTypesHeaderElement.innerHTML = display;
    this.tablesAreaClickEventAdder();
    document.querySelector(".table-area").click();
  }

  tablesAreaClickEventAdder() {
    const buttons = document.querySelectorAll(".table-area");
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        this.showTable(button.innerHTML);
        this.highlightSelectedButton(button);
      });
    });
  }

  showTable(selectedArea) {
    const tables = document.querySelectorAll(".table");
    this.selectedTableArea = selectedArea;
    tables.forEach((table) => {
      if (table.getAttribute("data-table-area") === selectedArea) {
        table.style.display = "flex";
      } else if (selectedArea === "Tümü") {
        table.style.display = "flex";
      } else {
        table.style.display = "none";
      }
    });
  }

  showOpenTables() {
    const buttons = document.querySelectorAll(".tables-status-button");
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        this.showOpenTableDisplay(button);
        button.classList.add("selected");
        setTimeout(() => {
          button.classList.remove("selected");
        }, 300);
      });
    });
  }

  showOpenTableDisplay(button) {
    const tables = document.querySelectorAll(".table");
    const attribute = button.getAttribute("data-status");
    tables.forEach((table) => {
      let tableArea =
        table.getAttribute("data-table-area") == this.selectedTableArea;
      if (
        table.classList.contains("full-table") &&
        attribute == "open" &&
        tableArea
      ) {
        table.style.display = "flex";
      } else if (
        table.classList.contains("full-table") &&
        attribute == "open" &&
        this.selectedTableArea == "Tümü"
      ) {
        table.style.display = "flex";
      } else if (attribute == "all" && tableArea) {
        table.style.display = "flex";
      } else if (attribute == "all" && this.selectedTableArea == "Tümü") {
        table.style.display = "flex";
      } else {
        table.style.display = "none";
      }
    });
  }

  highlightSelectedButton(selectedButton) {
    const buttons = document.querySelectorAll(".table-area");
    buttons.forEach((button) => {
      if (button === selectedButton) {
        button.classList.add("selected");
      } else {
        button.classList.remove("selected");
      }
    });
  }

  async getTablesDisplay() {
    const tablesData = await this.getTables();
    if (tablesData.status_code === "no_session") {
      alert("Oturum zaman aşımına uğramış.");
      localStorage.setItem("session", "false");
      window.location.href = baseUrl + "login";
    }
    const tableListElement = document.getElementById("tables");
    let display = "";
    tablesData.forEach((element) => {
    if (element.table_status === "close") {
        display += `
            <section 
                id="table-${element.id}"
                data-table-number="${element.table_number}"
                data-table-total-amount="${element.table_amount}"
                data-table-area="${element.table_area}"
                class="empty-table table"
            >
                <div class="table-id">${element.table_area} ${element.table_number}</div>
                <div id="table-status-${element.id}" class="table-status"><span>Boş</span></div>
                <div class="table-meta-data">
                    <span id="table-waiter-${element.id}"></span>
                    <span id="table-amount-${element.id}"></span>
                </div>
            </section>
        `;
      } else if (element.table_status === "open") {
        const dateInfo = element.opening_time;
        const parts = dateInfo.split(" ");
        const timeParts = parts[1].split(":");
        const hour = timeParts[0];
        const minutes = timeParts[1];
        display += `
            <section 
                id="table-${element.id}"
                data-table-number="${element.table_number}"
                data-table-total-amount="${element.table_amount}"
                data-table-area="${element.table_area}"
                class="full-table table"
            >
                <div class="table-id">${element.table_area} ${element.table_number}</div>
                <div id="table-status-${element.id}" class="table-status"><span>${this.formatter.moneyFormatter(element.table_amount,"TRY")}</span></div>
                <div class="table-meta-data">
                    <span id="table-waiter-${element.id}">${element.first_waiter}</span>
                    <span id="table-amount-${element.id}">${hour}:${minutes}</span>
                </div>
            </section>
        `;
      }
    });
    tableListElement.innerHTML = display;
    this.tableClickEventAdder();
  }

  tableClickEventAdder() {
    const buttons = document.querySelectorAll(".table");
    buttons.forEach((button) => {
      button.addEventListener("click", function () {
        const selectedTableNumber = button.getAttribute("data-table-number");
        const selectedTableTotalAmount = button.getAttribute("data-table-total-amount");
        const selectedTableArea = button.getAttribute("data-table-area");
        localStorage.setItem("selected-table-number", selectedTableNumber);
        localStorage.setItem("selected-table-total-amount",selectedTableTotalAmount);
        localStorage.setItem("selected-table-area", selectedTableArea);
        window.location.href = baseUrl + "table-operations";
      });
    });
  }

  async getTablesDataUpdate() {
    const tablesData = await this.getTables();
    tablesData.forEach((element) => {
      if (element.table_status === "close") {
        const table = document.getElementById(`table-${element.id}`);
        table.classList.remove("full-table");
        table.classList.add("empty-table");

        const tableStatus = document.getElementById(`table-status-${element.id}`);
        const waiterName = document.getElementById(`table-waiter-${element.id}`);
        const tableAmount = document.getElementById(`table-amount-${element.id}`);

        tableStatus.innerText = "Boş";
        waiterName.innerText = "";
        tableAmount.innerText = "";

        table.dataset.tableTotalAmount = element.table_amount;

      } else if (element.table_status === "open") {
        const dateInfo = element.opening_time;
        const parts = dateInfo.split(" ");
        const timeParts = parts[1].split(":");
        const hour = timeParts[0];
        const minutes = timeParts[1];

        const table = document.getElementById(`table-${element.id}`);
        table.classList.remove("empty-table");
        table.classList.add("full-table");

        const tableStatus = document.getElementById(`table-status-${element.id}`);
        const waiterName = document.getElementById(`table-waiter-${element.id}`);
        const tableAmount = document.getElementById(`table-amount-${element.id}`);

        tableStatus.innerText = `${this.formatter.moneyFormatter(element.table_amount,"TRY")}`;
        waiterName.innerText = element.first_waiter;
        tableAmount.innerText = hour + ":" + minutes;

        table.dataset.tableTotalAmount = element.table_amount;
      }
    });
  }
}
