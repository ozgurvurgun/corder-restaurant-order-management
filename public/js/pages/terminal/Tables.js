import TableManagement from "../../modules/TableManagement.js";

export default class Tables {
  constructor() {
    const tableManagement = new TableManagement();
    tableManagement.getTablesDisplay();
    tableManagement.getTablesAreaDisplay();
    tableManagement.showOpenTables();

    setInterval(() => {
      tableManagement.getTablesDataUpdate();
    }, 1200);
  }
}
