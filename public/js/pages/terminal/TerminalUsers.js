import UserManagement from "../../modules/UserManagement.js";

export default class TerminalUsers {
  constructor() {
    const userManagement = new UserManagement();
    userManagement.getSubUsersDisplay();
  }
}
