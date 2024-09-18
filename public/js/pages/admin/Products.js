import FileManager from "../../modules/FileManager.js";
import RequestHandler from "../../libs/RequestHandler.js";
import Modal from "../../modules/Modal.js";
import Switcher from "../../modules/Switcher.js";
import LazyLoader from "../../libs/LazyLoader.js";

export default class Products {
  constructor() {
    this.fileManager = new FileManager();
    const switcher = new Switcher();
    switcher.switch(
      document.querySelectorAll(".switcher"),
      baseUrl + "terminal-service/product-status-update"
    );

    // REGISTER PRODUCT FILE
    this.fileManager.singleFile(
      document.getElementById("product-file"),
      document.querySelector(".product-file-filename")
    );

    this.updateProductFile();

    const registerButton = document.querySelector(".register-button");
    registerButton.addEventListener("click", () => {
      this.categoryRegister();
    });

    const modalOpenButton = document.querySelectorAll(".modal-open-button");
    const modalUpdateButton = document.querySelector(".modal-update-button");
    modalUpdateButton.addEventListener("click", () => {
      this.modalDataUpdate();
    });

    const modal = new Modal(
      document.getElementById("modal"),
      modalOpenButton,
      document.getElementById("modal-close-button")
    );

    modalOpenButton.forEach((element) => {
      element.addEventListener("click", () => {
        const id = element.dataset.id;
        this.selectedProductId = element.dataset.id;
        const productName = document.getElementById(
          "product-table-product-name-" + id
        ).innerHTML;
        const productPrice = document.getElementById(
          "product-table-product-price-" + id
        ).innerHTML;

        const modalProductName = document.getElementById("modal-product-name");
        const modalProductPrice = document.getElementById(
          "modal-product-price"
        );

        modalProductName.value = productName;
        modalProductPrice.value = productPrice;
      });
    });

    new LazyLoader();
  }

  async categoryRegister() {
    let productName = document.querySelector(".product-name-input").value;
    let productPrice = document.querySelector(".product-price-input").value;
    let selectedCategory = document.getElementById("selected-category").value;

    productName = productName.trim();
    productPrice = productPrice.trim();
    const productImageFile = this.fileManager.getFile();
    if (productName == "") {
      alert("Lütfen ürün adını girin.");
      return;
    }
    if (productPrice == "") {
      alert("Lütfen ürün fiyatını girin.");
      return;
    }
    if (selectedCategory == "0") {
      alert("Lütfen kategori seçin.");
      return;
    }
    if (productImageFile == null) {
      alert("Lütfen ürün resmi seçin.");
      return;
    }

    const request = new RequestHandler();
    const data = [
      { key: "product-file", value: productImageFile },
      { key: "product-name", value: productName },
      { key: "product-price", value: productPrice },
      { key: "selected-category", value: selectedCategory },
    ];

    const response = await request.post(
      baseUrl + "terminal-service/insert-product",
      data
    );

    if (response.status_code == "success") {
      alert(`${productName}, ürünü başarı ile eklendi.`);
      location.reload(true);
    } else if (response.status_code == "file_download_error") {
      alert(`Dosya yükleme hatası!\nKayıt başarısız.`);
    } else if (response.status_code == "database_registration_error") {
      alert(`Veritabanı kayıt hatası!\nKayıt başarısız.`);
    } else if (response.status_code == "already_registered") {
      alert(
        `${selectedCategory}, kategorisinde ${productName} ürünü zaten kayıtlı.`
      );
    } else {
      alert(`Öngörülemeyen bir hata gerçekleşti!\nKayıt başarısız.`);
    }
  }

  async modalDataUpdate() {
    const request = new RequestHandler();
    const productName = document.getElementById("modal-product-name").value;
    const productPrice = document.getElementById("modal-product-price").value;

    const data = [
      { key: "id", value: this.selectedProductId },
      { key: "product-name", value: productName },
      { key: "product-price", value: productPrice },
    ];

    const response = await request.post(
      baseUrl + "terminal-service/update-product",
      data
    );
    if (response.status_code == "success") {
      alert("Güncelleme başarılı.");
      document.getElementById(
        "product-table-product-name-" + this.selectedProductId
      ).innerHTML = productName;
      document.getElementById(
        "product-table-product-price-" + this.selectedProductId
      ).innerHTML = productPrice;
    }
  }

  updateProductFile() {
    const fileManager = new FileManager();
    fileManager.singleFile(document.getElementById("new-product-file"));
    document
      .getElementById("new-product-file")
      .addEventListener("change", async () => {
        const file = fileManager.getFile();
        const data = [
          { key: "product-id", value: this.selectedProductId },
          { key: "product-file", value: file },
        ];
        const request = new RequestHandler();
        const response = await request.post(
          baseUrl + "terminal-service/product-file-update",
          data
        );
        if ((response.status_code = "success")) {
          alert("Ürün fotoğrafı başarı ile güncellendi.");
          const productFile = document.getElementById(`product-file-${this.selectedProductId}`);
          productFile.src= `${productFile.src + new Date().getTime()}`;
        } else {
          alert("Ürün fotoğrafı güncellenirken bir hata oluştu!");
        }
      });
  }
}
