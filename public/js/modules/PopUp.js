export default class PopUp {
  constructor(
    modalId,
    openButtonIds = [],
    closeButtonIds = [],
    defaultState = false
  ) {
    this.modal = document.getElementById(modalId);

    this.openButtons = openButtonIds.map((id) => document.getElementById(id));

    this.closeButtons = closeButtonIds.map((id) => document.getElementById(id));

    this.init();

    if (defaultState) {
      this.open();
    } else {
      this.close();
    }
  }

  init() {
    // Attach event listeners to all close buttons

    this.closeButtons.forEach((button) => {
      button.onclick = () => {
        this.close();
      };
    });

    // Attach event listeners to all open buttons

    this.openButtons.forEach((button) => {
      button.onclick = () => {
        this.open();
      };
    });

    // Close the modal if user clicks outside of it

    // window.onclick = (event) => {

    //   if (event.target === this.modal) {

    //     this.close();

    //   }

    // };
  }

  open() {
    this.modal.style.display = "flex";
  }

  close() {
    this.modal.style.display = "none";
  }
}
