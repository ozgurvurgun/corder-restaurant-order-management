class AdminMain {
  constructor() {
    this.activePage = window.location.origin + this.rtrimChar(window.location.pathname);
    this.loadModule();
  }

  async loadModule() {
    switch (this.activePage) {
      case this.rtrimChar(baseUrl + "admin/dashboard"): {
        const { default: Dashboard } = await import("./pages/admin/Dashboard.js");
        new Dashboard();
        break;
      }

      case this.rtrimChar(baseUrl + "admin/tables"): {
        // const { default: Tables } = await import("./pages/admin/Tables.js");
        // new Tables();
        break;
      }

      case this.rtrimChar(baseUrl + "admin/categories"): {
        const { default: Categories } = await import("./pages/admin/Categories.js");
        new Categories();
        break;
      }

      case this.rtrimChar(baseUrl + "admin/products"): {
        const { default: Dashboard } = await import("./pages/admin/Products.js");
        new Dashboard();
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

new AdminMain();
