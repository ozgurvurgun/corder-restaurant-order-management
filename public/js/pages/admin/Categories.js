import FileManager from "../../modules/FileManager.js";

import RequestHandler from "../../libs/RequestHandler.js";

import Switcher from "../../modules/Switcher.js";

import Modal from "../../modules/Modal.js";

import LazyLoader from "../../libs/LazyLoader.js";

export default class Categories {
  constructor() {
    this.fileManager = new FileManager();

    const switcher = new Switcher();

    this.updateProductFile();

    switcher.switch(
      document.querySelectorAll(".switcher"),

      baseUrl + "terminal-service/category-status-update"
    );

    this.fileManager.singleFile(
      document.getElementById("category-file"),

      document.querySelector(".category-file-filename")
    );

    const registerButton = document.querySelector(".register-button");

    registerButton.addEventListener("click", () => {
      this.categoryRegister();
    });

    const modalOpenButton = document.querySelectorAll(".modal-open-button");

    const modal = new Modal(
      document.getElementById("modal"),

      modalOpenButton,

      document.getElementById("modal-close-button")
    );

    const modalUpdateButton = document.querySelector(".modal-update-button");

    modalUpdateButton.addEventListener("click", () => {
      this.modalDataUpdate();
    });

    modalOpenButton.forEach((element) => {
      element.addEventListener("click", () => {
        const id = element.dataset.id;

        this.selectedCategorytId = element.dataset.id;

        this.oldCategoryName = document.getElementById(
          "category-table-category-name-" + id
        ).innerHTML;

        const modalCategoryName = document.getElementById(
          "modal-category-name"
        );

        modalCategoryName.value = this.oldCategoryName;
      });
    });

    new LazyLoader();
  }

  async categoryRegister() {
    let categoryName = document.querySelector(".category-name-input").value;

    categoryName = categoryName.trim();

    const categoryImageFile = this.fileManager.getFile();

    if (categoryName == "") {
      alert("Lütfen kategori adını girin.");

      return;
    }

    if (categoryImageFile == null) {
      alert("Lütfen kategori resmi seçin.");

      return;
    }

    const request = new RequestHandler();

    const data = [
      { key: "category-file", value: categoryImageFile },

      { key: "category-name", value: categoryName },
    ];

    const response = await request.post(
      baseUrl + "terminal-service/insert-category",

      data
    );

    if (response.status_code == "success") {
      alert(`${categoryName}, kategorisi başarı ile eklendi.`);

      location.reload(true);
    } else if (response.status_code == "file_download_error") {
      alert(`Dosya yükleme hatası!\nKayıt başarısız.`);
    } else if (response.status_code == "database_registration_error") {
      alert(`Veritabanı kayıt hatası!\nKayıt başarısız.`);
    } else if (response.status_code == "already_registered") {
      alert(`${categoryName}, kategorisi zaten kayıtlı.`);
    } else {
      alert(`Öngörülemeyen bir hata gerçekleşti!\nKayıt başarısız.`);
    }
  }

  async modalDataUpdate() {
    const request = new RequestHandler();

    const categoryName = document.getElementById("modal-category-name").value;

    const oldCategoryName = document.getElementById(
      "modal-category-name"
    ).value;

    const data = [
      { key: "id", value: this.selectedCategorytId },

      { key: "category-name", value: categoryName },

      { key: "old-category-name", value: this.oldCategoryName },
    ];

    const response = await request.post(
      baseUrl + "terminal-service/update-category",

      data
    );

    if (response.status_code == "success") {
      alert("Güncelleme başarılı.");

      document.getElementById(
        "category-table-category-name-" + this.selectedCategorytId
      ).innerHTML = categoryName;
    } else if (response.status_code == "already_registered") {
      alert(`${categoryName}, kategorisi zaten kayıtlı!`);
    } else {
      alert(`Öngörülemeyen bir hata oluştu.\nGüncelleme başarısız!`);
    }
  }

  updateProductFile() {
    const fileManager = new FileManager();

    fileManager.singleFile(document.getElementById("new-category-file"));

    document

      .getElementById("new-category-file")

      .addEventListener("change", async () => {
        const file = fileManager.getFile();

        const data = [
          { key: "category-id", value: this.selectedCategorytId },

          { key: "category-file", value: file },
        ];

        const request = new RequestHandler();

        const response = await request.post(
          baseUrl + "terminal-service/category-file-update",

          data
        );

        if ((response.status_code = "success")) {
          alert("Kategori fotoğrafı başarı ile güncellendi.");

          const categoryFile = document.getElementById(
            `category-file-${this.selectedCategorytId}`
          );

          categoryFile.src = `${categoryFile.src + new Date().getTime()}`;
        } else {
          alert("Kategori fotoğrafı güncellenirken bir hata oluştu!");
        }
      });
  }
}
