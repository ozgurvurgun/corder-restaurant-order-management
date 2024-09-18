import Scroll from "../../modules/Scroll.js";
export default class Dashboard {
  constructor() {
    alert()
    const scroll = new Scroll(
      document.querySelector("#food-categories-container"),
      document.querySelector("#food-categories"),
      2
    );
  }
}
