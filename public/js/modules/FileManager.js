export default class FileManager {
  constructor() {
    this.file = null;
    this.fileName = null;
  }

  singleFile(fileInputPar, filenameDisplayPar = null) {
    const fileInput = fileInputPar;
    const filenameDisplay = filenameDisplayPar;

    fileInput.addEventListener("change", () => {
      if (filenameDisplay != null) {
        filenameDisplay.innerHTML = `<p></p>`;
      }

      const file = fileInput.files[0];

      if (file) {
        this.fileName = file.name;

        if (!this.fileName.toLowerCase().endsWith(".png")) {
          if (filenameDisplay != null) {
            filenameDisplay.innerHTML = `<p style="color:red;">Dosya PNG formatında olmalıdır.</p>`;
          }
          this.file = null;
        } else {
          if (filenameDisplay != null) {
            filenameDisplay.innerHTML = `<p>${this.fileName}</p>`;
          }

          this.file = file;
        }
      }
    });
  }

  getFile() {
    return this.file;
  }

  getFileName() {
    return this.fileName;
  }
}
