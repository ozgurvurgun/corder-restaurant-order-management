import LoginOperations from "../../modules/LoginOperations.js";

export default class Login {
  constructor() {
    const loginOperations = new LoginOperations();
    loginOperations.authenticateUserDisplay();
  }
}
