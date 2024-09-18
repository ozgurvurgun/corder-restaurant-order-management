export default class Modal {
  constructor(modal_id, open_button_class, close_button_id) {
    const modal = modal_id;
    open_button_class.forEach((element) => {
      element.addEventListener("click", () => {
        modal.style.display = "block";
      });
    });

    close_button_id.addEventListener("click", () => {
      modal.style.display = "none";
    });

    window.addEventListener("click", function (event) {
      if (event.target == modal) {
        modal.style.display = "none";
      }
    });
  }
}
