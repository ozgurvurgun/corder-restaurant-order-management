export default class ModeToggle {
  constructor(modeToggleSelector) {
    this.modeToggle = document.querySelector(modeToggleSelector);
    this.mode = localStorage.getItem("mode");
    this.initialize();
  }

  initialize() {
    this.modeToggle.addEventListener("click", () => this.toggleMode());
    this.updateMode();
  }

  toggleMode() {
    document.body.classList.toggle("dark");
    this.updateLocalStorage();
  }

  updateLocalStorage() {
    const mode = document.body.classList.contains("dark") ? "dark" : "light";
    localStorage.setItem("mode", mode);
  }

  updateMode() {
    if (this.mode === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }
}