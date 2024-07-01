class Main {
  constructor() {
    this.activePage =
      window.location.origin + this.rtrimChar(window.location.pathname);
    this.loadModule();
  }

  async loadModule() {
    switch (this.activePage) {
      case this.rtrimChar(baseUrl + "login"): {
        const { default: Login } = await import("./pages/terminal/Login.js");
        const login = new Login();
        break;
      }

      case this.rtrimChar(baseUrl + "terminal-users"): {
        const { default: TerminalUsers } = await import(
          "./pages/terminal/TerminalUsers.js"
        );
        const terminalUsers = new TerminalUsers();
        break;
      }

      case this.rtrimChar(baseUrl + "tables"): {
        const { default: Tables } = await import("./pages/terminal/Tables.js");
        const tables = new Tables();
        break;
      }

      case this.rtrimChar(baseUrl + "table-operations"): {
        const { default: TablesOperations } = await import(
          "./pages/terminal/TableOperations.js"
        );
        const tablesOperations = new TablesOperations();
        break;
      }

      case this.rtrimChar(baseUrl + "terminal-menu"): {
        const { default: TerminalMenu } = await import(
          "./pages/terminal/TerminalMenu.js"
        );
        const terminalMenu = new TerminalMenu();
        break;
      }

      case this.rtrimChar(baseUrl + "terminal-cart"): {
        const { default: TerminalCart } = await import(
          "./pages/terminal/TerminalCart.js"
        );
        const terminalCart = new TerminalCart();
        break;
      }

      case this.rtrimChar(baseUrl + "receipt"): {
        const { default: Receipt } = await import(
          "./pages/terminal/Receipt.js"
        );
        const terminalCart = new Receipt();
        break;
      }

      default: {
        console.log(`No module found for ${this.activePage}`);
      }
    }
  }

  rtrimChar(str, char = "/") {
    const regex = new RegExp(`[${char}]+$`);
    return str.replace(regex, "");
  }
}

new Main();
